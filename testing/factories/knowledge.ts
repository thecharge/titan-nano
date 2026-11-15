import { strict as assert } from "node:assert";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ErrorCode,
  IoLimit,
  KnowledgeCommand,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgeLimitField,
  KnowledgePublicationStage,
  KnowledgeSearchMode,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeHub, knowledgeBytes, parseKnowledgeFile } from "@titan/knowledge";
import { readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  KnowledgeEntryResultSchema,
  KnowledgeSearchPageSchema,
  KnowledgeSettingsSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";

export function knowledgeDraft(kind: KnowledgeKind) {
  return { kind, title: "Time zones", tags: ["clock"], body: "Check time zones first" };
}
export async function knowledgeFormat(text: string, maximum: number = KnowledgeLimit.EntryBytes) {
  return parseKnowledgeFile(Buffer.from(text), maximum);
}

export async function knowledgeHubInput(command: KnowledgeCommand, input: unknown) {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    try {
      const initial = await hub.add({
        ...knowledgeDraft(KnowledgeKind.Fact),
        id: "11111111-1111-4111-8111-111111111111",
      });
      const error = await thrownBy(async () => {
        switch (command) {
          case KnowledgeCommand.Add:
            return hub.add(input);
          case KnowledgeCommand.Update:
            return hub.update(input);
          case KnowledgeCommand.Delete:
            return hub.delete(input);
          case KnowledgeCommand.Get:
            return hub.get(String(input));
          case KnowledgeCommand.Search:
            return hub.search(input);
          default:
            throw new Error("Unsupported knowledge input fixture");
        }
      });
      if (error !== undefined) {
        assert.deepEqual(await hub.get(initial.entry.id), initial);
        throw error;
      }
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function knowledgeLiveConsistency(
  kind: KnowledgeKind,
  changed: boolean,
  reindex = false,
) {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    try {
      const initial = await hub.add(knowledgeDraft(kind));
      const path = entryPath(home, kind, initial.entry.id);
      if (changed)
        await writeFile(
          path,
          reindex
            ? Buffer.from("{")
            : knowledgeBytes(
                { ...initial.entry, body: "External changed content" },
                IoLimit.DataBytes,
              ),
        );
      const before = await readFileBytes(path, IoLimit.DataBytes);
      const error = await thrownBy(async () => {
        if (reindex) await hub.reindex();
        else assert.deepEqual(await hub.get(initial.entry.id), initial);
      });
      assert.deepEqual(await readFileBytes(path, IoLimit.DataBytes), before);
      if (error !== undefined) {
        if (reindex)
          await assert.rejects(() => hub.get(initial.entry.id), {
            code: ErrorCode.KnowledgeUnavailable,
          });
        throw error;
      }
      return true;
    } finally {
      await hub.close();
    }
  });
}

async function readKnowledgeState(hub: KnowledgeHub, id: string) {
  try {
    return await hub.get(id);
  } catch (error) {
    if (error instanceof TitanError && error.code === ErrorCode.KnowledgeMissing) return null;
    throw error;
  }
}

async function operateVersion(
  hub: KnowledgeHub,
  id: string,
  kind: KnowledgeKind,
  command: KnowledgeCommand,
  version: number,
): Promise<void> {
  if (command === KnowledgeCommand.Update)
    await hub.update({ id, version, entry: { ...knowledgeDraft(kind), body: "Changed version" } });
  else await hub.delete({ id, version });
}

export async function knowledgeVersion(
  command: KnowledgeCommand,
  kind: KnowledgeKind,
  stale: boolean,
) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const initial = await hub.add(knowledgeDraft(kind));
      const id = initial.entry.id;
      const before = await readFileBytes(entryPath(home, kind, id), IoLimit.DataBytes);
      const error = await thrownBy(async () => {
        await operateVersion(hub, id, kind, command, stale ? 2 : 1);
      });
      const current = await readKnowledgeState(hub, id);
      const unchanged = current
        ? before.equals(await readFileBytes(entryPath(home, kind, id), IoLimit.DataBytes))
        : false;
      const peer = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
      return {
        code: error instanceof TitanError ? error.code : null,
        version: current?.entry.version ?? null,
        history: await exists(historyPath(home, kind, id, 1)),
        unchanged,
        healthy: peer.entry.version === 1 && peer.entry.id !== id,
      };
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeAdmission(field: KnowledgeLimitField, overflow: boolean) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home);
    try {
      const initial = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
      const id = initial.entry.id;
      const before = await readFileBytes(
        entryPath(home, KnowledgeKind.Fact, id),
        IoLimit.DataBytes,
      );
      const index = await readFileBytes(
        join(home, KnowledgeFile.Directory, KnowledgeFile.Index),
        KnowledgeLimit.IndexBytes,
      );
      const candidate = {
        ...knowledgeDraft(KnowledgeKind.Lesson),
        id: newId(),
        version: 1,
        body: "Check time zones for the second candidate",
      };
      const bytes = knowledgeBytes(candidate, IoLimit.DataBytes);
      const budgets = {
        [KnowledgeLimitField.Entries]: overflow ? 1 : 2,
        [KnowledgeLimitField.EntryBytes]: overflow
          ? before.length
          : Math.max(before.length, bytes.length),
        [KnowledgeLimitField.TotalBytes]: before.length + (overflow ? 0 : bytes.length),
        [KnowledgeLimitField.IndexBytes]: index.length + (overflow ? 0 : 1024),
      };
      await hub.close();
      hub = await KnowledgeHub.open(
        home,
        KnowledgeSettingsSchema.parse({ [field]: budgets[field] }),
      );
      const error = await thrownBy(async () => {
        await hub.add(candidate);
      });
      const candidateState = await readKnowledgeState(hub, candidate.id);
      const same = (
        await readFileBytes(entryPath(home, KnowledgeKind.Fact, id), IoLimit.DataBytes)
      ).equals(before);
      const healthy = await hub.update({
        id,
        version: 1,
        entry: knowledgeDraft(KnowledgeKind.Fact),
      });
      const rebuilt = await hub.reindex();
      return {
        refused: error instanceof TitanError,
        absent: candidateState === null,
        unchanged: same,
        healthy: healthy.entry.version === 2 && rebuilt.revision === healthy.revision,
        clean: !(await exists(join(home, KnowledgeFile.Directory, KnowledgeFile.Journal))),
      };
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

function entryPath(home: string, kind: KnowledgeKind, id: string) {
  return join(
    home,
    KnowledgeFile.Directory,
    kind,
    id + (kind === KnowledgeKind.Persona ? KnowledgeFile.Yaml : KnowledgeFile.Markdown),
  );
}

function historyPath(home: string, kind: KnowledgeKind, id: string, version: number) {
  return join(
    home,
    KnowledgeFile.Directory,
    KnowledgeFile.History,
    kind,
    id,
    String(version) +
      (kind === KnowledgeKind.Persona ? KnowledgeFile.Yaml : KnowledgeFile.Markdown),
  );
}

async function interruptKnowledge(hub: KnowledgeHub, id: string, remove: boolean): Promise<void> {
  if (remove) await hub.delete({ id, version: 1 });
  else
    await hub.update({
      id,
      version: 1,
      entry: { ...knowledgeDraft(KnowledgeKind.Fact), body: "Check time zones after recovery" },
    });
}

export async function knowledgeRoundTrip(kind: KnowledgeKind, remove: boolean) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home);
    try {
      const initial = KnowledgeEntryResultSchema.parse(await hub.add(knowledgeDraft(kind)));
      const id = initial.entry.id;
      const first = await readFileBytes(entryPath(home, kind, id), IoLimit.DataBytes);
      const changed = KnowledgeEntryResultSchema.parse(
        await hub.update({
          id,
          version: 1,
          entry: { ...knowledgeDraft(kind), body: "Check time zones first after update" },
        }),
      );
      const retained = await readFileBytes(historyPath(home, kind, id, 1), IoLimit.DataBytes);
      const second = await readFileBytes(entryPath(home, kind, id), IoLimit.DataBytes);
      const words = KnowledgeSearchPageSchema.parse(
        await hub.search({ question: "time zones", mode: KnowledgeSearchMode.Words }),
      );
      const fallback = KnowledgeSearchPageSchema.parse(
        await hub.search({ question: "time zones" }),
      );
      const visible = words.results[0];
      const matches =
        visible?.id === id && visible.matched.includes("[time] [zones]") && visible.score === null;
      const sameRevision =
        changed.revision === words.revision && words.revision === fallback.revision;
      if (remove) await hub.delete({ id, version: 2 });
      await hub.close();
      await rm(join(home, KnowledgeFile.Database));
      await rm(join(home, KnowledgeFile.Directory, KnowledgeFile.Index));
      hub = await KnowledgeHub.open(home);
      const recovered = await hub.search({
        question: "time zones",
        mode: KnowledgeSearchMode.Words,
      });
      const missing = await thrownBy(async () => {
        await hub.get(id);
      });
      const final = remove ? null : await hub.get(id);
      const removedHistory = remove
        ? (await readFileBytes(historyPath(home, kind, id, 2), IoLimit.DataBytes)).equals(second)
        : true;
      return {
        matches,
        sameRevision,
        history: retained.equals(first) && removedHistory,
        versions: initial.entry.version === 1 && changed.entry.version === 2,
        fallback: fallback.warning !== null && fallback.actual_mode === KnowledgeSearchMode.Words,
        recovered: remove ? recovered.results.length === 0 : recovered.results[0]?.id === id,
        final: remove
          ? missing instanceof Error &&
            "code" in missing &&
            missing.code === ErrorCode.KnowledgeMissing
          : final?.entry.body === changed.entry.body,
        indexed: await exists(join(home, KnowledgeFile.Directory, KnowledgeFile.Index)),
      };
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeRecovery(stage: KnowledgePublicationStage, remove: boolean) {
  async function observe(home: string) {
    let armed = false;
    let hub = await KnowledgeHub.open(home, {}, async (observed) => {
      if (armed && observed === stage)
        throw new Error("Injected knowledge publication interruption");
    });
    try {
      const initial = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
      const id = initial.entry.id;
      const before = await readFileBytes(
        entryPath(home, KnowledgeKind.Fact, id),
        IoLimit.DataBytes,
      );
      armed = true;
      const error = await thrownBy(async () => {
        await interruptKnowledge(hub, id, remove);
      });
      const fenced = await thrownBy(async () => {
        await hub.get(id);
      });
      const journal = await exists(join(home, KnowledgeFile.Directory, KnowledgeFile.Journal));
      await hub.close();
      hub = await KnowledgeHub.open(home);
      const state = await thrownBy(async () => {
        await hub.get(id);
      });
      const entry = remove ? null : await hub.get(id);
      const search = await hub.search({ question: "time zones", mode: KnowledgeSearchMode.Words });
      return {
        interrupted:
          error instanceof Error && error.message === "Injected knowledge publication interruption",
        fenced:
          fenced instanceof Error &&
          "code" in fenced &&
          fenced.code === ErrorCode.KnowledgeUnavailable,
        journal,
        recovered: remove
          ? state instanceof Error && "code" in state && state.code === ErrorCode.KnowledgeMissing
          : entry?.entry.version === 2 && entry.entry.body === "Check time zones after recovery",
        history: (
          await readFileBytes(historyPath(home, KnowledgeKind.Fact, id, 1), IoLimit.DataBytes)
        ).equals(before),
        indexed: remove
          ? search.results.length === 0
          : search.results[0]?.id === id && search.revision === entry?.revision,
        cleared: !(await exists(join(home, KnowledgeFile.Directory, KnowledgeFile.Journal))),
      };
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeShutdown(kind: KnowledgeKind, interrupt: boolean) {
  async function observe(home: string) {
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const hub = await KnowledgeHub.open(home, { max_pending_operations: 2 }, async (stage) => {
      if (stage !== KnowledgePublicationStage.Journal) return;
      entered.resolve();
      await released.promise;
      if (interrupt) throw new Error("Injected shutdown interruption");
    });
    try {
      const first = thrownBy(async () => {
        await hub.add(knowledgeDraft(kind));
      });
      await entered.promise;
      const second = thrownBy(async () => {
        await hub.add(knowledgeDraft(kind));
      });
      const closing = thrownBy(async () => {
        await hub.close();
      });
      const late = await thrownBy(async () => {
        await readKnowledgeState(hub, newId());
      });
      released.resolve();
      const firstError = await first;
      const secondError = await second;
      const closeError = await closing;
      await hub.close();
      const reopened = await KnowledgeHub.open(home);
      try {
        const page = await reopened.search({ kind });
        return {
          closed: closeError === undefined,
          lateRefused: late instanceof TitanError && late.code === ErrorCode.KnowledgeUnavailable,
          firstSettled: interrupt ? firstError instanceof Error : firstError === undefined,
          secondSettled: interrupt ? secondError instanceof TitanError : secondError === undefined,
          retained: page.results.length === (interrupt ? 1 : 2),
        };
      } finally {
        await reopened.close();
      }
    } finally {
      released.resolve();
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
