import { strict as assert } from "node:assert";
import { join } from "node:path";
import {
  ErrorCode,
  KnowledgeAttemptLimit,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgePublicationStage,
  KnowledgeSearchMode,
  KnowledgeState,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { KnowledgeAttemptDocumentSchema } from "@titan/types";
import { knowledgeDraft } from "./knowledge.ts";
import { knowledgeAttemptPath, knowledgeAttemptScope } from "./knowledge-attempts.ts";

export async function knowledgeViewSearchOwn(kind: KnowledgeKind, question: boolean) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home);
    try {
      const scope = knowledgeAttemptScope();
      const draft = { ...knowledgeDraft(kind), body: "Original shared signal" };
      const changed = await hub.add(draft);
      const removed = await hub.add(draft);
      const retained = await hub.add(draft);
      const id = newId();
      const entry = { ...draft, body: "Private checked proposal" };
      const other = {
        ...entry,
        kind: kind === KnowledgeKind.Fact ? KnowledgeKind.Lesson : KnowledgeKind.Fact,
      };
      await hub.attempts.stage(scope, {
        revision: null,
        mutations: [
          { id: changed.entry.id, version: 1, entry },
          { id: removed.entry.id, version: 1, entry: null },
          { id, version: null, entry },
          { id: newId(), version: null, entry: other },
        ],
      });
      const query = question
        ? { question: "private", kind, mode: KnowledgeSearchMode.Words }
        : { kind };
      const index = await readFileBytes(
        join(home, KnowledgeFile.Directory, KnowledgeFile.Index),
        KnowledgeLimit.IndexBytes,
      );
      const before = await hub.search(query);
      const page = await hub.view(scope).search(query);
      assert.equal(page.revision, before.revision);
      assert.equal(page.private_revision, 1);
      assert.equal(page.actual_mode, KnowledgeSearchMode.Words);
      assert.equal(page.warning === null, question);
      const pending = page.results.filter((result) => result.visibility === KnowledgeState.Pending);
      assert.deepEqual(
        new Set(pending.map((result) => result.id)),
        new Set([changed.entry.id, id]),
      );
      assert.ok(pending.every((result) => result.path === knowledgeAttemptPath(home, scope)));
      assert.equal(pending.find((result) => result.id === changed.entry.id)?.version, 2);
      assert.equal(pending.find((result) => result.id === id)?.version, 1);
      assert.equal(
        page.results.some((result) => result.id === removed.entry.id),
        false,
      );
      assert.equal(
        page.results.some((result) => result.id === retained.entry.id),
        !question,
      );
      assert.equal(page.results.length, question ? 2 : 3);
      if (question)
        assert.ok(pending.every((result) => result.matched.toLowerCase().includes("[private]")));
      const peer = await hub.view({ ...scope, candidate_id: newId() }).search(query);
      assert.deepEqual(
        peer.results.map((result) => result.id),
        before.results.map((result) => result.id),
      );
      assert.equal(peer.private_revision, null);
      assert.ok(peer.results.every((result) => result.visibility === KnowledgeState.Final));
      assert.deepEqual(await hub.search(query), before);
      assert.deepEqual(
        await readFileBytes(
          join(home, KnowledgeFile.Directory, KnowledgeFile.Index),
          KnowledgeLimit.IndexBytes,
        ),
        index,
      );
      const document = KnowledgeAttemptDocumentSchema.parse(
        JSON.parse(
          (
            await readFileBytes(pending[0]?.path ?? "", KnowledgeAttemptLimit.DocumentBytes)
          ).toString(),
        ),
      );
      assert.deepEqual(document.scope, scope);
      await hub.close();
      hub = await KnowledgeHub.open(home);
      assert.deepEqual(await hub.view(scope).search(query), page);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewSearchPage(kind: KnowledgeKind, short: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const scope = knowledgeAttemptScope();
      const draft = { ...knowledgeDraft(kind), body: "Paging signal" };
      const finals = [await hub.add(draft), await hub.add(draft), await hub.add(draft)];
      finals.sort((left, right) => left.entry.id.localeCompare(right.entry.id));
      const removed = finals
        .slice(0, 2)
        .map((result) => ({ id: result.entry.id, version: 1, entry: null }));
      const id = newId();
      await hub.attempts.stage(scope, {
        revision: null,
        mutations: [...removed, { id, version: null, entry: draft }],
      });
      const query = {
        kind,
        question: "paging",
        limit: short ? 1 : 2,
        mode: KnowledgeSearchMode.Words,
      };
      const page = await hub.view(scope).search(query);
      assert.equal(page.results.length, short ? 1 : 2);
      assert.equal(page.results[0]?.id, id);
      assert.equal(page.results[0]?.visibility, KnowledgeState.Pending);
      assert.equal(page.truncated, short);
      if (!short) assert.equal(page.results[1]?.id, finals[2]?.entry.id);
      assert.equal(
        page.results.some((result) => removed.some((mutation) => mutation.id === result.id)),
        false,
      );
      assert.equal((await hub.search(query)).results.length, short ? 1 : 2);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewSearchTerminal(kind: KnowledgeKind, discard: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const scope = knowledgeAttemptScope();
      const proposal = await hub
        .view(scope)
        .add({ private_revision: null, entry: knowledgeDraft(kind) });
      if (discard) await hub.attempts.discard(scope, 1);
      else await hub.attempts.publish(scope, 1);
      const page = await hub.view(scope).search({ kind, mode: KnowledgeSearchMode.Words });
      assert.equal(page.private_revision, 1);
      assert.equal(page.results.length, discard ? 0 : 1);
      assert.ok(page.results.every((result) => result.visibility === KnowledgeState.Final));
      if (!discard) assert.equal(page.results[0]?.id, proposal.entry.id);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewSearchGuard(
  kind: KnowledgeKind,
  mode: KnowledgeSearchMode,
  invalid: boolean,
) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const scope = knowledgeAttemptScope();
      const view = hub.view(scope);
      await view.add({ private_revision: null, entry: knowledgeDraft(kind) });
      if (invalid) {
        await assert.rejects(view.search({}), { code: ErrorCode.KnowledgeInvalid });
        await assert.rejects(view.search({ question: "...", mode }), {
          code: ErrorCode.KnowledgeInvalid,
        });
        assert.equal(
          (await view.search({ kind, mode: KnowledgeSearchMode.Words })).results.length,
          1,
        );
        return true;
      }
      if (mode === KnowledgeSearchMode.Meaning) {
        await assert.rejects(view.search({ kind, mode }), { code: ErrorCode.NotBuilt });
        return true;
      }
      const page = await view.search({ kind, mode });
      assert.equal(page.warning === null, mode === KnowledgeSearchMode.Words);
      assert.equal(page.results.length, 1);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewSearchQueue(kind: KnowledgeKind, fail: boolean) {
  async function observe(home: string) {
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    let armed = false;
    const hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (!armed || stage !== KnowledgePublicationStage.Journal) return;
      entered.resolve();
      await released.promise;
      if (fail) throw new Error("Interrupted search publication");
    });
    try {
      const scope = knowledgeAttemptScope();
      const draft = { ...knowledgeDraft(kind), body: "First private signal" };
      const first = await hub.view(scope).add({ private_revision: null, entry: draft });
      armed = true;
      const writing = fail
        ? assert.rejects(hub.add(draft), { message: "Interrupted search publication" })
        : hub.add(draft);
      await entered.promise;
      const query = { kind, mode: KnowledgeSearchMode.Words };
      const searching = fail
        ? assert.rejects(hub.view(scope).search(query), { code: ErrorCode.KnowledgeUnavailable })
        : hub.view(scope).search(query);
      const revised = { ...draft, body: "Second signal" };
      const editing = fail
        ? assert.rejects(hub.attempts.stage(scope, { revision: 1, mutations: [] }), {
            code: ErrorCode.KnowledgeUnavailable,
          })
        : hub.attempts.stage(scope, {
            revision: 1,
            mutations: [{ id: first.entry.id, version: null, entry: revised }],
          });
      released.resolve();
      await writing;
      const page = await searching;
      await editing;
      if (!page) return true;
      assert.equal(page.private_revision, 1);
      assert.equal(page.results.length, 2);
      assert.equal(page.results[0]?.matched, draft.body);
      assert.equal(page.revision, (await hub.search(query)).revision);
      const next = await hub.view(scope).search(query);
      assert.equal(next.private_revision, 2);
      assert.equal(next.results[0]?.matched, "Second signal");
      return true;
    } finally {
      released.resolve();
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeViewSearchBudget(count: number, expanded: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const scope = knowledgeAttemptScope();
      const draft = { ...knowledgeDraft(KnowledgeKind.Fact), title: "x", tags: [] };
      const first = await hub.add(draft);
      const query = {
        kind: KnowledgeKind.Fact,
        limit: KnowledgeLimit.MaximumPage,
        mode: KnowledgeSearchMode.Words,
      };
      const sample = (await hub.search(query)).results[0];
      assert.ok(sample);
      const target = Math.floor(KnowledgeLimit.PageBytes / count) - draft.title.length;
      const overhead = Buffer.byteLength(JSON.stringify(sample));
      const width = Math.floor(
        (target - overhead - KnowledgeLimit.Tags * 3) /
          (KnowledgeLimit.Tags * Buffer.byteLength("界")),
      );
      const tags = expanded
        ? Array.from({ length: KnowledgeLimit.Tags }, () => "界".repeat(width))
        : [];
      const padding = expanded
        ? target - Buffer.byteLength(JSON.stringify({ ...sample, tags }))
        : 0;
      assert.ok(padding >= 0 && padding < KnowledgeLimit.TitleCharacters);
      const entry = { ...draft, tags, title: "x".repeat(padding + draft.title.length) };
      await hub.update({ id: first.entry.id, version: 1, entry });
      for (let index = 1; index < count - 1; index++) await hub.add(entry);
      const publicPage = await hub.search(query);
      assert.equal(publicPage.truncated, false);
      assert.equal(publicPage.results.length, count - 1);
      await hub.view(scope).add({ private_revision: null, entry });
      const page = await hub.view(scope).search(query);
      assert.ok(page.results.length > 0);
      assert.equal(page.results[0]?.visibility, KnowledgeState.Pending);
      assert.ok(Buffer.byteLength(JSON.stringify(page.results)) <= KnowledgeLimit.PageBytes);
      assert.equal(page.truncated, expanded);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
