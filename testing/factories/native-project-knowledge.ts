import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import {
  ErrorCode,
  KnowledgeAttemptState,
  type KnowledgeKind,
  KnowledgeSearchMode,
  KnowledgeState,
  RunHubKinds,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub, nativeRunKnowledge, ownedKnowledge, ownedRunHub } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { knowledgeDraft } from "./knowledge.ts";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";

export async function nativeProjectKnowledge(kind: KnowledgeKind, discard: boolean) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    const shared = await KnowledgeHub.open(home);
    try {
      const owned = ownedKnowledge(home, {}, 8, shared);
      const scope = knowledgeAttemptScope();
      const original = await shared.add(knowledgeDraft(kind));
      const compatible = ownedRunHub(home, {}, 8, shared);
      assert.equal(
        (await compatible.read(original.entry.title, project)).some(
          (entry) => entry.id === original.entry.id,
        ),
        RunHubKinds.some((value) => value === kind),
      );
      const id = newId();
      const stale = await owned.use(project, async (local, home) => {
        await local.add({ id: original.entry.id, ...knowledgeDraft(kind) });
        const hub = await nativeRunKnowledge(local, home, scope);
        const view = hub.view(scope);
        assert.equal((await view.get(original.entry.id)).visibility, KnowledgeState.Final);
        const fallback = await shared.add(knowledgeDraft(kind));
        assert.equal((await view.get(fallback.entry.id)).visibility, KnowledgeState.Final);
        const added = await view.add({
          private_revision: null,
          entry: { id, ...knowledgeDraft(kind) },
        });
        assert.equal(added.visibility, KnowledgeState.Pending);
        const updated = await view.update({
          private_revision: added.private_revision,
          id,
          version: added.entry.version,
          entry: knowledgeDraft(kind),
        });
        assert.equal((await view.get(id)).private_revision, updated.private_revision);
        const deleted = await view.delete({
          private_revision: updated.private_revision,
          id: original.entry.id,
          version: original.entry.version,
        });
        await assert.rejects(() => view.get(original.entry.id), {
          code: ErrorCode.KnowledgeMissing,
        });
        const page = await view.search({ kind, mode: KnowledgeSearchMode.Words });
        assert.equal(page.private_revision, deleted.private_revision);
        assert.equal(
          page.results.some((row) => row.id === original.entry.id),
          false,
        );
        assert.equal(
          page.results.some((row) => row.id === fallback.entry.id),
          true,
        );
        assert.equal(page.results.find((row) => row.id === id)?.visibility, KnowledgeState.Pending);
        assert.equal((await hub.get(original.entry.id)).entry.id, original.entry.id);
        assert.equal(
          (await hub.search({ kind, mode: KnowledgeSearchMode.Words })).results.some(
            (row) => row.id === id,
          ),
          false,
        );
        await assert.rejects(() => hub.get(id), { code: ErrorCode.KnowledgeMissing });
        await assert.rejects(() => hub.view({ ...scope, attempt: 2 }).get(id), {
          code: ErrorCode.KnowledgeMissing,
        });
        return view;
      });
      await assert.rejects(() => stale.get(id), { code: ErrorCode.KnowledgeUnavailable });
      const recreated = ownedKnowledge(home, {}, 8, shared);
      const document = await recreated.attempts.read(scope, project);
      assert.ok(document);
      if (discard) await recreated.attempts.discard(scope, document.revision, project);
      else await recreated.attempts.publish(scope, document.revision, project);
      await recreated.use(project, async (local) => {
        const final = await local.attempts.read(scope);
        assert.equal(
          final?.state,
          discard ? KnowledgeAttemptState.Discarded : KnowledgeAttemptState.Published,
        );
        if (discard)
          await assert.rejects(() => local.get(id), { code: ErrorCode.KnowledgeMissing });
        else assert.equal((await local.get(id)).entry.id, id);
      });
      await assert.rejects(() => shared.get(id), { code: ErrorCode.KnowledgeMissing });
      return true;
    } finally {
      await shared.close();
    }
  });
}

export async function nativeProjectLegacy(kind: KnowledgeKind, collision: boolean) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    const shared = await KnowledgeHub.open(home);
    try {
      const owned = ownedKnowledge(home, {}, 8, shared);
      const scope = knowledgeAttemptScope();
      const entry = await shared
        .view(scope)
        .add({ private_revision: null, entry: knowledgeDraft(kind) });
      if (collision) {
        await owned.use(project, async (local, home) => {
          await local.view(scope).add({ private_revision: null, entry: knowledgeDraft(kind) });
          await assert.rejects(() => nativeRunKnowledge(local, home, scope), {
            code: ErrorCode.KnowledgeConflict,
          });
        });
        await assert.rejects(() => owned.attempts.read(scope, project), {
          code: ErrorCode.KnowledgeConflict,
        });
        assert.equal((await shared.attempts.read(scope))?.state, KnowledgeAttemptState.Open);
      } else {
        await owned.use(project, async (local, home) => {
          const hub = await nativeRunKnowledge(local, home, scope);
          assert.equal(
            (await hub.view(scope).get(entry.entry.id)).visibility,
            KnowledgeState.Pending,
          );
        });
        const document = await owned.attempts.read(scope, project);
        assert.ok(document);
        await owned.attempts.publish(scope, document.revision, project);
        assert.equal((await shared.get(entry.entry.id)).entry.id, entry.entry.id);
        const same = await owned.attempts.read(scope);
        assert.equal(same?.state, KnowledgeAttemptState.Published);
      }
      return true;
    } finally {
      await shared.close();
    }
  });
}
