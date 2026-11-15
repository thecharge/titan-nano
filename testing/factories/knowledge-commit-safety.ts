import { strict as assert } from "node:assert";
import { link, mkdir, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ErrorCode,
  KnowledgeCommitFixture,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgePublicationStage,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub, knowledgeBytes } from "@titan/knowledge";
import { readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type KnowledgeCommit, KnowledgeSettingsSchema } from "@titan/types";
import { knowledgeDraft } from "./knowledge.ts";

export function knowledgePublicationSettings(input: unknown) {
  const parsed = KnowledgeSettingsSchema.safeParse(input);
  if (parsed.success && JSON.stringify(input) === "{}") {
    assert.equal(Object.hasOwn(parsed.data, "max_publication_entries"), false);
    assert.equal(Object.hasOwn(parsed.data, "max_publication_bytes"), false);
    assert.equal(Object.hasOwn(parsed.data, "max_publication_receipts"), false);
  }
  return parsed.success;
}

export async function knowledgeCommitVersion(
  version: number,
  remove: boolean,
  kind: KnowledgeKind,
) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home);
    const draft = knowledgeDraft(kind);
    const original = await hub.add(draft);
    await hub.close();
    const path = join(
      home,
      KnowledgeFile.Directory,
      kind,
      original.entry.id + KnowledgeFile.Markdown,
    );
    const bytes = knowledgeBytes({ ...original.entry, version }, KnowledgeLimit.EntryBytes);
    await writeFile(path, bytes);
    hub = await KnowledgeHub.open(home);
    try {
      const commit = {
        publication_id: newId(),
        mutations: [{ id: original.entry.id, version, entry: remove ? null : draft }],
      };
      const error = await thrownBy(async () => {
        await hub.commit(commit);
      });
      if (error) {
        assert.equal((await readFileBytes(path, KnowledgeLimit.EntryBytes)).equals(bytes), true);
        assert.deepEqual((await hub.get(original.entry.id)).entry, { ...original.entry, version });
      } else {
        const receipt = await hub.commit(commit);
        assert.equal(receipt.changes[0]?.version, remove ? version : version + 1);
      }
      return error instanceof Error && "code" in error ? error.code : null;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

async function linkedReceipts(home: string, mode: KnowledgeCommitFixture, publication: string) {
  const directory = join(home, KnowledgeFile.Directory, KnowledgeFile.Publications);
  if (mode === KnowledgeCommitFixture.Directory) {
    await mkdir(join(directory, newId()));
    return;
  }
  const outside = join(home, newId());
  if (mode === KnowledgeCommitFixture.LinkedDirectory) {
    await rename(directory, outside);
    await symlink(outside, directory);
    return;
  }
  const path = join(directory, publication + KnowledgeFile.Json);
  await writeFile(outside, "External receipt bytes");
  if (mode === KnowledgeCommitFixture.LinkedReceipt) await symlink(outside, path);
  else await link(outside, path);
}

export async function knowledgeCommitReceiptBoundary(mode: KnowledgeCommitFixture) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const commit: KnowledgeCommit = {
        publication_id: newId(),
        mutations: [{ id: newId(), version: null, entry: knowledgeDraft(KnowledgeKind.Fact) }],
      };
      const first = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
      const initialized = { ...commit, publication_id: newId() };
      await hub.commit(initialized);
      await linkedReceipts(home, mode, commit.publication_id);
      await assert.rejects(hub.commit(commit), { code: ErrorCode.KnowledgeCorrupt });
      assert.deepEqual((await hub.get(first.entry.id)).entry, first.entry);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeCommitSnapshot(kind: KnowledgeKind, interrupt: boolean) {
  async function observe(home: string) {
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (stage !== KnowledgePublicationStage.File) return;
      entered.resolve();
      await released.promise;
      if (interrupt) throw new Error("Interrupted snapshot publication");
    });
    const commit: KnowledgeCommit = {
      publication_id: newId(),
      mutations: [
        { id: newId(), version: null, entry: knowledgeDraft(kind) },
        { id: newId(), version: null, entry: knowledgeDraft(kind) },
      ],
    };
    try {
      assert.equal((await hub.search({ kind })).results.length, 0);
      const committing = thrownBy(async () => {
        await hub.commit(commit);
      });
      await entered.promise;
      let settled = false;
      const reading = thrownBy(async () => {
        const page = await hub.search({ kind });
        settled = true;
        assert.equal(page.results.length, 2);
        assert.equal(page.revision, (await hub.commit(commit)).revision);
      });
      assert.equal(settled, false);
      released.resolve();
      const commitError = await committing;
      const readError = await reading;
      if (interrupt) {
        assert.ok(commitError instanceof Error);
        assert.ok(
          readError instanceof Error &&
            "code" in readError &&
            readError.code === ErrorCode.KnowledgeUnavailable,
        );
      } else {
        assert.equal(commitError, undefined);
        assert.equal(readError, undefined);
      }
      return true;
    } finally {
      released.resolve();
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
