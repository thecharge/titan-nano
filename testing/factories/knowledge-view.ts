import { strict as assert } from "node:assert";
import {
  ErrorCode,
  KnowledgeKind,
  KnowledgeState,
  KnowledgeViewFixture,
  TaskOutcome,
} from "@titan/constants";
import { newId, settle } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeHub } from "@titan/knowledge";
import { KnowledgeMessage } from "@titan/messages";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { knowledgeDraft } from "./knowledge.ts";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";

export async function knowledgeViewCycle(kind: KnowledgeKind, discard: boolean) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home);
    const scope = knowledgeAttemptScope();
    let view = hub.view(scope);
    try {
      const added = await view.add({ private_revision: null, entry: knowledgeDraft(kind) });
      assert.equal(added.private_revision, 1);
      assert.equal(added.visibility, KnowledgeState.Pending);
      assert.deepEqual(await view.get(added.entry.id), added);
      await assert.rejects(hub.get(added.entry.id), { code: ErrorCode.KnowledgeMissing });
      await assert.rejects(hub.view({ ...scope, candidate_id: newId() }).get(added.entry.id), {
        code: ErrorCode.KnowledgeMissing,
      });
      assert.equal((await hub.search({ kind })).results.length, 0);
      const edited = await view.update({
        id: added.entry.id,
        version: 1,
        private_revision: 1,
        entry: { ...knowledgeDraft(kind), body: "Revised private content" },
      });
      assert.equal(edited.entry.version, 1);
      assert.equal(edited.private_revision, 2);
      await hub.close();
      hub = await KnowledgeHub.open(home);
      view = hub.view(scope);
      assert.deepEqual(await view.get(added.entry.id), edited);
      if (discard) {
        await hub.attempts.discard(scope, 2);
        await assert.rejects(view.get(added.entry.id), { code: ErrorCode.KnowledgeMissing });
        await assert.rejects(view.add({ private_revision: 2, entry: knowledgeDraft(kind) }), {
          code: ErrorCode.KnowledgeConflict,
        });
        return true;
      }
      await hub.attempts.publish(scope, 2);
      const final = await view.get(added.entry.id);
      assert.equal(final.visibility, KnowledgeState.Final);
      assert.deepEqual(final.entry, edited.entry);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewEdit(kind: KnowledgeKind, conflict: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const scope = knowledgeAttemptScope();
      const view = hub.view(scope);
      const final = await hub.add(knowledgeDraft(kind));
      const input = {
        id: final.entry.id,
        version: 1,
        entry: { ...knowledgeDraft(kind), body: "First private edit" },
      };
      assert.equal((await view.get(final.entry.id)).private_revision, null);
      await view.update({ ...input, private_revision: null });
      assert.deepEqual((await hub.get(final.entry.id)).entry, final.entry);
      const revised = await view.update({
        ...input,
        version: 2,
        private_revision: 1,
        entry: { ...input.entry, body: "Second private edit" },
      });
      assert.equal(revised.entry.version, 2);
      assert.equal(revised.private_revision, 2);
      assert.equal((await hub.attempts.read(scope))?.mutations[0]?.version, 1);
      if (conflict) {
        const peer = await hub.update(input);
        await assert.rejects(hub.attempts.publish(scope, 2), { code: ErrorCode.KnowledgeConflict });
        assert.deepEqual((await hub.get(final.entry.id)).entry, peer.entry);
        assert.deepEqual((await view.get(final.entry.id)).entry, revised.entry);
        return true;
      }
      await hub.attempts.publish(scope, 2);
      assert.deepEqual((await hub.get(final.entry.id)).entry, revised.entry);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewDelete(kind: KnowledgeKind, pending: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const scope = knowledgeAttemptScope();
      const view = hub.view(scope);
      const original = pending
        ? await view.add({ private_revision: null, entry: knowledgeDraft(kind) })
        : await hub.add(knowledgeDraft(kind));
      const deleted = await view.delete({
        id: original.entry.id,
        version: 1,
        private_revision: pending ? 1 : null,
      });
      assert.equal(deleted.private_revision, pending ? 2 : 1);
      await assert.rejects(view.get(original.entry.id), { code: ErrorCode.KnowledgeMissing });
      if (!pending) assert.deepEqual((await hub.get(original.entry.id)).entry, original.entry);
      const document = await hub.attempts.read(scope);
      assert.ok(document);
      assert.equal(document.mutations.length, pending ? 0 : 1);
      await hub.attempts.publish(scope, document.revision);
      await assert.rejects(hub.get(original.entry.id), { code: ErrorCode.KnowledgeMissing });
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewGuard(kind: KnowledgeKind, mode: KnowledgeViewFixture) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(
      home,
      mode === KnowledgeViewFixture.Bytes ? { max_entry_bytes: 256 } : {},
    );
    try {
      const scope = knowledgeAttemptScope();
      const view = hub.view(scope);
      const draft = knowledgeDraft(kind);
      const final = await hub.add(draft);
      if (mode === KnowledgeViewFixture.Invalid) {
        await assert.rejects(view.add(null), { code: ErrorCode.KnowledgeInvalid });
        await assert.rejects(view.add([]), { code: ErrorCode.KnowledgeInvalid });
        await assert.rejects(
          view.add({ private_revision: null, entry: { ...draft, version: 2 } }),
          { code: ErrorCode.KnowledgeInvalid },
        );
        await assert.rejects(view.update({}), { code: ErrorCode.KnowledgeInvalid });
        await assert.rejects(view.delete({}), { code: ErrorCode.KnowledgeInvalid });
        return true;
      }
      if (mode === KnowledgeViewFixture.Unavailable) {
        hub.get = async () => {
          throw new TitanError(ErrorCode.KnowledgeUnavailable, KnowledgeMessage.Unavailable);
        };
        await assert.rejects(view.add({ private_revision: null, entry: draft }), {
          code: ErrorCode.KnowledgeUnavailable,
        });
        return true;
      }
      if (mode === KnowledgeViewFixture.Duplicate) {
        await assert.rejects(
          view.add({ private_revision: null, entry: { ...draft, id: final.entry.id } }),
          { code: ErrorCode.KnowledgeConflict },
        );
        const added = await view.add({ private_revision: null, entry: draft });
        await assert.rejects(
          view.add({ private_revision: 1, entry: { ...draft, id: added.entry.id } }),
          { code: ErrorCode.KnowledgeConflict },
        );
        return true;
      }
      if (mode === KnowledgeViewFixture.Bytes) {
        await assert.rejects(
          view.add({ private_revision: null, entry: { ...draft, body: "x".repeat(257) } }),
          { code: ErrorCode.KnowledgeInvalid },
        );
        await assert.rejects(
          view.update({
            id: final.entry.id,
            version: 1,
            private_revision: null,
            entry: { ...draft, body: "x".repeat(257) },
          }),
          { code: ErrorCode.KnowledgeInvalid },
        );
        return true;
      }
      if (mode === KnowledgeViewFixture.Persona) {
        const persona = await hub.add(knowledgeDraft(KnowledgeKind.Persona));
        await assert.rejects(
          view.delete({ id: persona.entry.id, version: 1, private_revision: null }),
          { code: ErrorCode.PermissionDenied },
        );
        return true;
      }
      const first = await view.update({
        id: final.entry.id,
        version: 1,
        private_revision: null,
        entry: draft,
      });
      const revision = mode === KnowledgeViewFixture.Revision ? null : first.private_revision;
      const version = mode === KnowledgeViewFixture.Version ? 1 : first.entry.version;
      const entry =
        mode === KnowledgeViewFixture.Kind ? { ...draft, kind: KnowledgeKind.Persona } : draft;
      const input = { id: final.entry.id, version, private_revision: revision, entry };
      if (mode === KnowledgeViewFixture.Observed) {
        assert.equal((await view.update(input)).private_revision, 2);
        return true;
      }
      await assert.rejects(view.update(input), {
        code:
          mode === KnowledgeViewFixture.Kind
            ? ErrorCode.KnowledgeInvalid
            : ErrorCode.KnowledgeConflict,
      });
      if (mode !== KnowledgeViewFixture.Kind)
        await assert.rejects(
          view.delete({ id: final.entry.id, version, private_revision: revision }),
          { code: ErrorCode.KnowledgeConflict },
        );
      assert.equal((await hub.attempts.read(scope))?.revision, 1);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewRace(kind: KnowledgeKind, same: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const owner = knowledgeAttemptScope();
      const peer = same ? owner : knowledgeAttemptScope();
      const results = await settle(
        [
          () => hub.view(owner).add({ private_revision: null, entry: knowledgeDraft(kind) }),
          () => hub.view(peer).add({ private_revision: null, entry: knowledgeDraft(kind) }),
        ],
        2,
      );
      const winners = results.filter((result) => result.status === TaskOutcome.Fulfilled);
      const losers = results.filter((result) => result.status === TaskOutcome.Rejected);
      assert.equal(winners.length, same ? 1 : 2);
      assert.equal(losers.length, same ? 1 : 0);
      for (const result of losers) {
        assert.ok(result.reason instanceof TitanError);
        assert.equal(result.reason.code, ErrorCode.KnowledgeConflict);
      }
      const document = await hub.attempts.read(owner);
      assert.equal(document?.revision, 1);
      assert.equal(document.mutations.length, 1);
      assert.equal((await hub.search({ kind })).results.length, 0);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewScope(kind: KnowledgeKind, invalid: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const scope = knowledgeAttemptScope();
      if (invalid) {
        assert.throws(() => hub.view({ ...scope, attempt: 0 }), {
          code: ErrorCode.KnowledgeInvalid,
        });
        assert.throws(() => hub.view({ ...scope, run_id: "../other-run" }), {
          code: ErrorCode.KnowledgeInvalid,
        });
        return true;
      }
      const view = hub.view(scope);
      const snapshot = { ...scope };
      scope.candidate_id = newId();
      const added = await view.add({ private_revision: null, entry: knowledgeDraft(kind) });
      assert.deepEqual((await hub.attempts.read(snapshot))?.scope, snapshot);
      assert.equal(await hub.attempts.read(scope), null);
      await assert.rejects(view.get("../invalid-id"), { code: ErrorCode.KnowledgeInvalid });
      assert.equal((await view.get(added.entry.id)).entry.id, added.entry.id);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
