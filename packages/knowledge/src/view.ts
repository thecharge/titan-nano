import {
  ErrorCode,
  KnowledgeAttemptFormat,
  KnowledgeAttemptState,
  KnowledgeKind,
  KnowledgeState,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  type KnowledgeAttemptDocument,
  type KnowledgeAttemptScope,
  KnowledgeAttemptScopeSchema,
  KnowledgeEntrySchema,
  type KnowledgeMutation,
  KnowledgeViewAddSchema,
  KnowledgeViewDeleteSchema,
  KnowledgeViewDeletionSchema,
  KnowledgeViewEntrySchema,
  KnowledgeViewUpdateSchema,
} from "@titan/types";
import { knowledgeBytes } from "./format.ts";
import type { KnowledgeHub } from "./hub.ts";

export class KnowledgeView {
  private scope;

  constructor(
    private hub: KnowledgeHub,
    scope: KnowledgeAttemptScope,
    private maximum: number,
  ) {
    const parsed = KnowledgeAttemptScopeSchema.safeParse(scope);
    if (!parsed.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Pending);
    this.scope = parsed.data;
  }

  search(input: unknown) {
    return this.hub.searchAttempt(this.scope, input);
  }

  private async editable(revision: number | null) {
    const document = await this.hub.attempts.read(this.scope);
    if (document && document.state !== KnowledgeAttemptState.Open)
      throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.PendingClosed);
    if ((document?.revision ?? null) !== revision)
      throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
    return document;
  }

  private async entry(id: string, document: KnowledgeAttemptDocument | null) {
    const pending = document?.mutations.find((mutation) => mutation.id === id);
    if (!pending) return (await this.hub.get(id)).entry;
    if (!pending.entry) throw new TitanError(ErrorCode.KnowledgeMissing, KnowledgeMessage.Missing);
    return KnowledgeEntrySchema.parse({
      ...pending.entry,
      id,
      version: (pending.version ?? 0) + 1,
    });
  }

  async get(id: string) {
    const document = await this.hub.attempts.read(this.scope);
    const pending =
      document?.state === KnowledgeAttemptState.Open ||
      document?.state === KnowledgeAttemptState.Prepared
        ? document
        : null;
    const entry = await this.entry(id, pending);
    return KnowledgeViewEntrySchema.parse({
      schema_version: KnowledgeAttemptFormat.Version,
      private_revision: document?.revision ?? null,
      visibility: pending?.mutations.some((mutation) => mutation.id === id)
        ? KnowledgeState.Pending
        : KnowledgeState.Final,
      entry,
    });
  }

  private async save(document: KnowledgeAttemptDocument | null, mutation: KnowledgeMutation) {
    const mutations = document?.mutations.filter((value) => value.id !== mutation.id) ?? [];
    if (mutation.version !== null || mutation.entry !== null) mutations.push(mutation);
    return this.hub.attempts.stage(this.scope, {
      revision: document?.revision ?? null,
      mutations,
    });
  }

  private result(document: KnowledgeAttemptDocument, entry: unknown) {
    return KnowledgeViewEntrySchema.parse({
      schema_version: KnowledgeAttemptFormat.Version,
      private_revision: document.revision,
      visibility: KnowledgeState.Pending,
      entry,
    });
  }

  private async absent(id: string) {
    try {
      await this.hub.get(id);
    } catch (error) {
      if (error instanceof TitanError && error.code === ErrorCode.KnowledgeMissing) return;
      throw error;
    }
    throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
  }

  async add(input: unknown) {
    const parsed = KnowledgeViewAddSchema.safeParse(input);
    if (
      !parsed.success ||
      (parsed.data.entry.version !== undefined && parsed.data.entry.version !== 1)
    )
      throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
    const document = await this.editable(parsed.data.private_revision);
    const { id, version, ...draft } = parsed.data.entry;
    const entry = KnowledgeEntrySchema.parse({
      ...draft,
      id: id ?? newId(),
      version: version ?? 1,
    });
    if (document?.mutations.some((mutation) => mutation.id === entry.id))
      throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
    await this.absent(entry.id);
    knowledgeBytes(entry, this.maximum);
    const saved = await this.save(document, { id: entry.id, version: null, entry: draft });
    return this.result(saved, entry);
  }

  async update(input: unknown) {
    const parsed = KnowledgeViewUpdateSchema.safeParse(input);
    if (!parsed.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
    const document = await this.editable(parsed.data.private_revision);
    const before = await this.entry(parsed.data.id, document);
    if (before.version !== parsed.data.version)
      throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
    if (before.kind !== parsed.data.entry.kind)
      throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
    const previous = document?.mutations.find((mutation) => mutation.id === before.id);
    const version = previous ? previous.version : before.version;
    const entry = KnowledgeEntrySchema.parse({
      ...parsed.data.entry,
      id: before.id,
      version: (version ?? 0) + 1,
    });
    knowledgeBytes(entry, this.maximum);
    const saved = await this.save(document, { id: entry.id, version, entry: parsed.data.entry });
    return this.result(saved, entry);
  }

  async delete(input: unknown) {
    const parsed = KnowledgeViewDeleteSchema.safeParse(input);
    if (!parsed.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
    const document = await this.editable(parsed.data.private_revision);
    const before = await this.entry(parsed.data.id, document);
    if (before.version !== parsed.data.version)
      throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
    if (before.kind === KnowledgeKind.Persona)
      throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDeletion);
    const previous = document?.mutations.find((mutation) => mutation.id === before.id);
    const saved = await this.save(document, {
      id: before.id,
      version: previous ? previous.version : before.version,
      entry: null,
    });
    return KnowledgeViewDeletionSchema.parse({
      schema_version: KnowledgeAttemptFormat.Version,
      private_revision: saved.revision,
      id: before.id,
      deleted_version: before.version,
    });
  }
}
