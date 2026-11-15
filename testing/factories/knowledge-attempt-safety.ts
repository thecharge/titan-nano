import { strict as assert } from "node:assert";
import { link, rm, symlink, writeFile } from "node:fs/promises";
import {
  ErrorCode,
  KnowledgeAttemptFixture,
  KnowledgeAttemptLimit,
  KnowledgeAttemptState,
  KnowledgeKind,
} from "@titan/constants";
import { KnowledgeHub } from "@titan/knowledge";
import { readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { KnowledgeAttemptDocumentSchema, type KnowledgeAttemptSettings } from "@titan/types";
import { knowledgeDraft } from "./knowledge.ts";
import {
  knowledgeAttemptChanges,
  knowledgeAttemptPath,
  knowledgeAttemptScope,
} from "./knowledge-attempts.ts";

export async function knowledgeAttemptAdmission(
  field: keyof KnowledgeAttemptSettings,
  allowed: boolean,
) {
  async function observe(home: string) {
    const limits = {
      max_sets: allowed ? 2 : 1,
      max_entries: allowed ? 2 : 1,
      max_bytes: allowed ? 4096 : 1,
    };
    const hub = await KnowledgeHub.open(home, { attempts: { [field]: limits[field] } });
    try {
      const owner = knowledgeAttemptScope();
      if (field === "max_sets")
        await hub.attempts.stage(knowledgeAttemptScope(), { revision: null, mutations: [] });
      const error = await thrownBy(async () => {
        await hub.attempts.stage(owner, {
          revision: null,
          mutations: knowledgeAttemptChanges(KnowledgeKind.Fact),
        });
      });
      const result = await hub.attempts.read(owner);
      if (allowed) assert.ok(result);
      else {
        assert.equal(result, null);
        assert.ok(
          error instanceof Error &&
            "code" in error &&
            error.code === (field === "max_bytes" ? ErrorCode.StreamLimit : ErrorCode.Capacity),
        );
      }
      assert.equal((await hub.search({ kind: KnowledgeKind.Fact })).results.length, 0);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeAttemptConflict(kind: KnowledgeKind, stale: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const owner = knowledgeAttemptScope();
      const first = await hub.add(knowledgeDraft(kind));
      const second = await hub.add(knowledgeDraft(kind));
      const pending = [first, second].map((entry) => ({
        id: entry.entry.id,
        version: 1,
        entry: { ...knowledgeDraft(kind), body: "Private checked proposal" },
      }));
      const staged = await hub.attempts.stage(owner, { revision: null, mutations: pending });
      if (stale) {
        const peer = await hub.update({
          id: second.entry.id,
          version: 1,
          entry: { ...knowledgeDraft(kind), body: "Peer committed knowledge" },
        });
        await assert.rejects(hub.attempts.publish(owner, 1), { code: ErrorCode.KnowledgeConflict });
        assert.deepEqual((await hub.get(first.entry.id)).entry, first.entry);
        assert.deepEqual((await hub.get(second.entry.id)).entry, peer.entry);
        assert.deepEqual(await hub.attempts.read(owner), staged);
        assert.equal((await hub.attempts.discard(owner, 1)).state, KnowledgeAttemptState.Discarded);
      } else {
        const published = await hub.attempts.publish(owner, 1);
        assert.ok(published.receipt);
        assert.equal((await hub.get(first.entry.id)).entry.version, 2);
        assert.equal((await hub.get(second.entry.id)).entry.version, 2);
      }
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeAttemptValidation(kind: KnowledgeKind, invalid: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const owner = knowledgeAttemptScope();
      const mutations = knowledgeAttemptChanges(kind);
      const first = mutations[0];
      assert.ok(first);
      if (invalid) mutations[1] = first;
      const error = await thrownBy(async () => {
        await hub.attempts.stage(owner, { revision: null, mutations });
      });
      if (invalid) {
        assert.ok(
          error instanceof Error && "code" in error && error.code === ErrorCode.KnowledgeInvalid,
        );
        assert.equal(await hub.attempts.read(owner), null);
      } else assert.equal(error, undefined);
      const invalidScope = { ...owner, step_id: "../outside" };
      await assert.rejects(
        async () => {
          await hub.attempts.read(invalidScope);
        },
        { code: ErrorCode.KnowledgeInvalid },
      );
      await assert.rejects(
        async () => {
          await hub.attempts.stage(knowledgeAttemptScope(), { revision: 0, mutations: [] });
        },
        { code: ErrorCode.KnowledgeInvalid },
      );
      await assert.rejects(hub.attempts.publish(knowledgeAttemptScope(), 1), {
        code: ErrorCode.KnowledgeMissing,
      });
      await assert.rejects(hub.attempts.discard(knowledgeAttemptScope(), 1), {
        code: ErrorCode.KnowledgeMissing,
      });
      await hub.close();
      await assert.rejects(hub.attempts.read(owner), { code: ErrorCode.KnowledgeUnavailable });
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

async function corruptPrivateFile(path: string, mode: KnowledgeAttemptFixture) {
  const original = await readFileBytes(path, KnowledgeAttemptLimit.DocumentBytes);
  const document = KnowledgeAttemptDocumentSchema.parse(JSON.parse(original.toString()));
  if (mode === KnowledgeAttemptFixture.Malformed) await writeFile(path, "{");
  if (mode === KnowledgeAttemptFixture.Scope)
    await writeFile(path, JSON.stringify({ ...document, scope: knowledgeAttemptScope() }));
  if (mode === KnowledgeAttemptFixture.Receipt)
    await writeFile(path, JSON.stringify({ ...document, state: KnowledgeAttemptState.Open }));
  if (mode === KnowledgeAttemptFixture.Digest && document.receipt)
    await writeFile(
      path,
      JSON.stringify({ ...document, receipt: { ...document.receipt, input_hash: "0".repeat(64) } }),
    );
  if (mode === KnowledgeAttemptFixture.Metadata && document.receipt)
    await writeFile(
      path,
      JSON.stringify({
        ...document,
        receipt: {
          ...document.receipt,
          changes: document.receipt.changes.map((change) => ({
            ...change,
            version: change.version + 1,
          })),
        },
      }),
    );
  if (mode === KnowledgeAttemptFixture.Linked || mode === KnowledgeAttemptFixture.Shared) {
    const outside = `${path}.external`;
    await writeFile(outside, original);
    await rm(path);
    if (mode === KnowledgeAttemptFixture.Linked) await symlink(outside, path);
    else await link(outside, path);
  }
  return original;
}

export async function knowledgeAttemptFile(mode: KnowledgeAttemptFixture) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home);
    try {
      const owner = knowledgeAttemptScope();
      const staged = await hub.attempts.stage(owner, {
        revision: null,
        mutations: knowledgeAttemptChanges(KnowledgeKind.Fact),
      });
      const published = await hub.attempts.publish(owner, staged.revision);
      const path = knowledgeAttemptPath(home, owner);
      const original = await corruptPrivateFile(path, mode);
      if (mode === KnowledgeAttemptFixture.Reopen) {
        await hub.close();
        hub = await KnowledgeHub.open(home);
      }
      const error = await thrownBy(async () => {
        assert.deepEqual(await hub.attempts.read(owner), published);
      });
      if (mode === KnowledgeAttemptFixture.Intact || mode === KnowledgeAttemptFixture.Reopen)
        assert.equal(error, undefined);
      else
        assert.ok(
          error instanceof Error && "code" in error && error.code === ErrorCode.KnowledgeCorrupt,
        );
      await rm(path);
      await writeFile(path, original);
      assert.deepEqual(await hub.attempts.read(owner), published);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
