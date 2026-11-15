import { resolve } from "node:path";
import {
  ErrorCode,
  ExitCode,
  HttpMethod,
  KnowledgeCommand,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgeRoute,
  KnowledgeSearchMode,
  KnowledgeServerCommand,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  type ClientConnector,
  type KnowledgeClient,
  KnowledgeDeleteSchema,
  KnowledgeDeletionResultSchema,
  KnowledgeDraftSchema,
  KnowledgeEntryResultSchema,
  KnowledgeHistoryPageSchema,
  KnowledgeHistoryQuerySchema,
  KnowledgeInputSchema,
  KnowledgeMaintenanceQuerySchema,
  KnowledgeMaintenanceResultSchema,
  KnowledgeReindexResultSchema,
  KnowledgeSearchPageSchema,
  KnowledgeSearchSchema,
  KnowledgeSelectionSchema,
  KnowledgeServerCallSchema,
  KnowledgeStatsSchema,
  KnowledgeUpdateSchema,
} from "@titan/types";
import { call } from "./client.ts";

function invalid(): never {
  throw new TitanError(ErrorCode.InvalidResponse, KnowledgeMessage.Client, ExitCode.Transport);
}

async function invoke(
  home: string,
  operation: KnowledgeCommand | KnowledgeServerCommand,
  input: unknown,
  connect?: ClientConnector,
) {
  const parsed = KnowledgeServerCallSchema.safeParse({ operation, input });
  if (!parsed.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
  await connect?.();
  return call(home, KnowledgeRoute, HttpMethod.Post, parsed.data);
}

function entryResult(value: unknown, id?: string, version?: number, draft?: unknown) {
  const result = KnowledgeEntryResultSchema.safeParse(value);
  if (!result.success) return invalid();
  const entry = result.data.entry;
  if ((id !== undefined && entry.id !== id) || (version !== undefined && entry.version !== version))
    return invalid();
  if (
    draft !== undefined &&
    hash(JSON.stringify(KnowledgeDraftSchema.strip().parse(entry))) !== hash(JSON.stringify(draft))
  )
    return invalid();
  return result.data;
}

export function createKnowledgeClient(home: string, connect?: ClientConnector): KnowledgeClient {
  return {
    async maintenance(operation, input) {
      const query = KnowledgeMaintenanceQuerySchema.parse(input);
      const result = KnowledgeMaintenanceResultSchema.safeParse(
        await invoke(home, operation, query, connect),
      );
      if (
        !result.success ||
        result.data.applied !== query.apply ||
        (query.before !== undefined && result.data.before !== query.before) ||
        (!query.apply && result.data.publications.length > 0)
      )
        return invalid();
      return result.data;
    },
    async restore(id) {
      KnowledgeSelectionSchema.parse({ id });
      const result = entryResult(await invoke(home, KnowledgeCommand.Restore, { id }, connect), id);
      if (result.entry.version < 2) return invalid();
      return result;
    },
    async add(input) {
      const parsed = KnowledgeInputSchema.safeParse(input);
      if (!parsed.success)
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
      return entryResult(
        await invoke(home, KnowledgeCommand.Add, parsed.data, connect),
        parsed.data.id,
        1,
        KnowledgeDraftSchema.strip().parse(parsed.data),
      );
    },
    async get(id) {
      return entryResult(await invoke(home, KnowledgeCommand.Get, { id }, connect), id);
    },
    async history(input) {
      const query = KnowledgeHistoryQuerySchema.safeParse(input);
      if (!query.success)
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
      const parsed = KnowledgeHistoryPageSchema.safeParse(
        await invoke(home, KnowledgeServerCommand.History, query.data, connect),
      );
      if (!parsed.success) return invalid();
      const page = parsed.data;
      if (Buffer.byteLength(JSON.stringify(page.entries)) > KnowledgeLimit.HistoryBytes)
        return invalid();
      const before = query.data.before ?? page.current_version;
      if (
        page.id !== query.data.id ||
        before > page.current_version ||
        page.entries.length > query.data.limit
      )
        return invalid();
      for (const [index, entry] of page.entries.entries())
        if (
          entry.id !== page.id ||
          entry.kind !== page.kind ||
          entry.version !== before - index - 1
        )
          return invalid();
      const remaining = before - page.entries.length - 1;
      if (
        (remaining > 0 && page.entries.length === 0) ||
        page.next_before !== (remaining > 0 ? remaining + 1 : null)
      )
        return invalid();
      return page;
    },
    async update(input) {
      const parsed = KnowledgeUpdateSchema.safeParse(input);
      if (!parsed.success)
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
      return entryResult(
        await invoke(home, KnowledgeCommand.Update, parsed.data, connect),
        parsed.data.id,
        parsed.data.version + 1,
        parsed.data.entry,
      );
    },
    async delete(input) {
      const parsed = KnowledgeDeleteSchema.safeParse(input);
      if (!parsed.success)
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
      const result = KnowledgeDeletionResultSchema.safeParse(
        await invoke(home, KnowledgeCommand.Delete, parsed.data, connect),
      );
      if (
        !result.success ||
        result.data.id !== parsed.data.id ||
        result.data.deleted_version !== parsed.data.version
      )
        return invalid();
      return result.data;
    },
    async search(input) {
      const parsed = KnowledgeSearchSchema.safeParse(input);
      if (!parsed.success)
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Search);
      const result = KnowledgeSearchPageSchema.safeParse(
        await invoke(home, KnowledgeCommand.Search, parsed.data, connect),
      );
      if (
        !result.success ||
        hash(JSON.stringify(result.data.query)) !== hash(JSON.stringify(parsed.data))
      )
        return invalid();
      const page = result.data;
      const fallback =
        parsed.data.mode === KnowledgeSearchMode.Both &&
        page.actual_mode === KnowledgeSearchMode.Words;
      const warning = fallback
        ? page.warning === KnowledgeMessage.MeaningUnavailable ||
          page.warning === KnowledgeMessage.EmbedderChanged
        : page.warning === null;
      if (
        (!fallback && page.actual_mode !== parsed.data.mode) ||
        (page.actual_mode !== KnowledgeSearchMode.Words && !parsed.data.question) ||
        page.results.length > parsed.data.limit ||
        !warning
      )
        return invalid();
      for (const row of page.results) {
        const extension =
          row.kind === KnowledgeKind.Persona ? KnowledgeFile.Yaml : KnowledgeFile.Markdown;
        if (
          (page.actual_mode === KnowledgeSearchMode.Words && row.score !== null) ||
          (page.actual_mode === KnowledgeSearchMode.Meaning && row.score === null) ||
          (parsed.data.kind !== undefined && row.kind !== parsed.data.kind) ||
          row.path !== resolve(home, KnowledgeFile.Directory, row.kind, row.id + extension)
        )
          return invalid();
      }
      return page;
    },
    async reindex() {
      const result = KnowledgeReindexResultSchema.safeParse(
        await invoke(home, KnowledgeCommand.Reindex, {}, connect),
      );
      if (!result.success) return invalid();
      return result.data;
    },
    async stats() {
      const result = KnowledgeStatsSchema.safeParse(
        await invoke(home, KnowledgeCommand.Stats, {}, connect),
      );
      if (!result.success) return invalid();
      return result.data;
    },
  };
}
