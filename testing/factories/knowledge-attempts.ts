import { strict as assert } from "node:assert";
import { join } from "node:path";
import {
  ErrorCode,
  KnowledgeAttemptFile,
  KnowledgeAttemptLimit,
  KnowledgeAttemptState,
  type KnowledgeKind,
  type KnowledgePublicationStage,
} from "@titan/constants";
import { hash, newId } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  KnowledgeAttemptDocumentSchema,
  type KnowledgeAttemptScope,
  type KnowledgeMutation,
} from "@titan/types";
import { knowledgeDraft } from "./knowledge.ts";

export function knowledgeAttemptScope(): KnowledgeAttemptScope {
  return {
    run_id: newId(),
    step_id: "implementation",
    part_id: null,
    candidate_id: newId(),
    attempt: 1,
  };
}

export function knowledgeAttemptChanges(kind: KnowledgeKind): KnowledgeMutation[] {
  return [
    { id: newId(), version: null, entry: knowledgeDraft(kind) },
    { id: newId(), version: null, entry: knowledgeDraft(kind) },
  ];
}

async function assertInvisible(hub: KnowledgeHub, mutations: KnowledgeMutation[]) {
  for (const mutation of mutations)
    await assert.rejects(hub.get(mutation.id), { code: ErrorCode.KnowledgeMissing });
}

export async function knowledgeAttemptRoundTrip(kind: KnowledgeKind, discard: boolean) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home);
    let attempts = hub.attempts;
    try {
      const owner = knowledgeAttemptScope();
      const mutations = knowledgeAttemptChanges(kind);
      assert.equal(await attempts.read(owner), null);
      const first = await attempts.stage(owner, { revision: null, mutations });
      assert.equal(first.state, KnowledgeAttemptState.Open);
      assert.equal(first.revision, 1);
      assert.deepEqual(first.mutations, mutations);
      assert.deepEqual(await attempts.read(owner), first);
      await assertInvisible(hub, mutations);
      assert.equal(await attempts.read({ ...owner, candidate_id: newId() }), null);
      assert.equal(await attempts.read({ ...owner, run_id: newId() }), null);
      assert.equal((await hub.search({ kind })).results.length, 0);
      await hub.close();
      hub = await KnowledgeHub.open(home);
      attempts = hub.attempts;
      assert.deepEqual(await attempts.read(owner), first);
      if (discard) {
        const removed = await attempts.discard(owner, 1);
        assert.equal(removed.state, KnowledgeAttemptState.Discarded);
        assert.deepEqual(removed.mutations, []);
        assert.deepEqual(await attempts.discard(owner, 1), removed);
        await assertInvisible(hub, mutations);
        await assert.rejects(attempts.stage(owner, { revision: 1, mutations }), {
          code: ErrorCode.KnowledgeConflict,
        });
        await assert.rejects(attempts.publish(owner, 1), { code: ErrorCode.KnowledgeConflict });
        return true;
      }
      const published = await attempts.publish(owner, 1);
      assert.equal(published.state, KnowledgeAttemptState.Published);
      assert.equal(published.receipt?.publication_id, first.publication_id);
      assert.deepEqual(await attempts.publish(owner, 1), published);
      for (const mutation of mutations) assert.equal((await hub.get(mutation.id)).entry.version, 1);
      await assert.rejects(attempts.discard(owner, 1), { code: ErrorCode.KnowledgeConflict });
      await assert.rejects(attempts.stage(owner, { revision: 1, mutations }), {
        code: ErrorCode.KnowledgeConflict,
      });
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeAttemptRevision(kind: KnowledgeKind, stale: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    const attempts = hub.attempts;
    try {
      const owner = knowledgeAttemptScope();
      const first = await attempts.stage(owner, {
        revision: null,
        mutations: knowledgeAttemptChanges(kind),
      });
      const mutation = first.mutations[0];
      assert.ok(mutation?.entry);
      mutation.entry.body = "Private revised content";
      if (stale) {
        await assert.rejects(
          attempts.stage(owner, { revision: null, mutations: first.mutations }),
          { code: ErrorCode.KnowledgeConflict },
        );
        assert.notDeepEqual(await attempts.read(owner), first);
      } else {
        const second = await attempts.stage(owner, { revision: 1, mutations: first.mutations });
        assert.equal(second.revision, 2);
        assert.equal(second.publication_id, first.publication_id);
        assert.deepEqual(second.mutations, first.mutations);
        await assert.rejects(attempts.publish(owner, 1), { code: ErrorCode.KnowledgeConflict });
        await assert.rejects(attempts.discard(owner, 1), { code: ErrorCode.KnowledgeConflict });
      }
      await assertInvisible(hub, first.mutations);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeAttemptLoser(
  kind: KnowledgeKind,
  byCandidate: boolean,
  loserPublishes: boolean,
) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    const attempts = hub.attempts;
    try {
      const loser = knowledgeAttemptScope();
      const winner = byCandidate
        ? { ...loser, candidate_id: newId() }
        : { ...loser, attempt: loser.attempt + 1 };
      const lost = knowledgeAttemptChanges(kind);
      const kept = knowledgeAttemptChanges(kind);
      const staged = await attempts.stage(loser, { revision: null, mutations: lost });
      await attempts.stage(winner, { revision: null, mutations: kept });
      assert.deepEqual((await attempts.read(winner))?.mutations, kept);
      assert.deepEqual((await attempts.read(loser))?.mutations, lost);
      await attempts.discard(loser, staged.revision);
      if (loserPublishes)
        await assert.rejects(attempts.publish(loser, staged.revision), {
          code: ErrorCode.KnowledgeConflict,
        });
      await attempts.publish(winner, 1);
      await assertInvisible(hub, lost);
      for (const mutation of kept) assert.equal((await hub.get(mutation.id)).entry.version, 1);
      assert.equal((await hub.search({ kind })).results.length, kept.length);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeAttemptRecovery(
  stage: KnowledgePublicationStage,
  kind: KnowledgeKind,
) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home, {}, async (current) => {
      if (stage === current) throw new Error("Interrupted private publication");
    });
    let attempts = hub.attempts;
    try {
      const owner = knowledgeAttemptScope();
      const staged = await attempts.stage(owner, {
        revision: null,
        mutations: knowledgeAttemptChanges(kind),
      });
      await assert.rejects(attempts.publish(owner, 1), {
        message: "Interrupted private publication",
      });
      await assert.rejects(attempts.read(owner), { code: ErrorCode.KnowledgeUnavailable });
      const prepared = KnowledgeAttemptDocumentSchema.parse(
        JSON.parse(
          (
            await readFileBytes(
              knowledgeAttemptPath(home, owner),
              KnowledgeAttemptLimit.DocumentBytes,
            )
          ).toString(),
        ),
      );
      assert.equal(prepared?.state, KnowledgeAttemptState.Prepared);
      assert.equal(prepared?.publication_id, staged.publication_id);
      await assert.rejects(attempts.stage(owner, { revision: 1, mutations: staged.mutations }), {
        code: ErrorCode.KnowledgeUnavailable,
      });
      await assert.rejects(attempts.discard(owner, 1), { code: ErrorCode.KnowledgeUnavailable });
      await hub.close();
      hub = await KnowledgeHub.open(home);
      attempts = hub.attempts;
      assert.deepEqual(await attempts.read(owner), prepared);
      await assert.rejects(attempts.stage(owner, { revision: 1, mutations: staged.mutations }), {
        code: ErrorCode.KnowledgeConflict,
      });
      await assert.rejects(attempts.discard(owner, 1), { code: ErrorCode.KnowledgeConflict });
      const published = await attempts.publish(owner, 1);
      assert.equal(published.state, KnowledgeAttemptState.Published);
      assert.deepEqual(await attempts.publish(owner, 1), published);
      for (const mutation of staged.mutations)
        assert.equal((await hub.get(mutation.id)).entry.version, 1);
      assert.equal((await hub.search({ kind })).results.length, 2);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeAttemptEmpty(kind: KnowledgeKind, discard: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    const attempts = hub.attempts;
    try {
      const owner = knowledgeAttemptScope();
      const first = await attempts.stage(owner, {
        revision: null,
        mutations: knowledgeAttemptChanges(kind),
      });
      const empty = await attempts.stage(owner, { revision: first.revision, mutations: [] });
      const final = discard
        ? await attempts.discard(owner, empty.revision)
        : await attempts.publish(owner, empty.revision);
      assert.equal(final.receipt, null);
      assert.deepEqual(final.mutations, []);
      assert.equal((await hub.search({ kind })).results.length, 0);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export function knowledgeAttemptPath(home: string, owner: KnowledgeAttemptScope) {
  return join(
    home,
    KnowledgeAttemptFile.Directory,
    hash(JSON.stringify(owner)) + KnowledgeAttemptFile.Extension,
  );
}
