import { strict as assert } from "node:assert";
import { rm, writeFile } from "node:fs/promises";
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
import {
  type KnowledgeCommit,
  type KnowledgeMutation,
  type KnowledgePublicationJournal,
  KnowledgePublicationJournalSchema,
  KnowledgePublicationReceiptSchema,
  type KnowledgeSettings,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { knowledgeDraft } from "./knowledge.ts";

function newPublication(kind: KnowledgeKind): KnowledgeCommit {
  return {
    publication_id: newId(),
    mutations: [
      { id: newId(), version: null, entry: knowledgeDraft(kind) },
      { id: newId(), version: null, entry: knowledgeDraft(kind) },
    ],
  };
}

function rootPath(home: string) {
  return join(home, KnowledgeFile.Directory);
}

function journalPath(home: string) {
  return join(rootPath(home), KnowledgeFile.Journal);
}

function receiptPath(home: string, id: string) {
  return join(rootPath(home), KnowledgeFile.Publications, id + KnowledgeFile.Json);
}

function entryPath(home: string, kind: KnowledgeKind, id: string) {
  return join(rootPath(home), kind, id + KnowledgeFile.Markdown);
}

async function assertMissing(hub: KnowledgeHub, mutations: KnowledgeMutation[]) {
  for (const mutation of mutations)
    await assert.rejects(hub.get(mutation.id), { code: ErrorCode.KnowledgeMissing });
}

async function assertPublication(hub: KnowledgeHub, commit: KnowledgeCommit) {
  const receipt = KnowledgePublicationReceiptSchema.parse(await hub.commit(commit));
  assert.equal(receipt.publication_id, commit.publication_id);
  assert.equal(receipt.changes.length, commit.mutations.length);
  for (const mutation of commit.mutations) {
    if (mutation.entry === null) {
      await assertMissing(hub, [mutation]);
      continue;
    }
    const result = await hub.get(mutation.id);
    assert.equal(result.revision, receipt.revision);
    assert.deepEqual(result.entry, {
      ...mutation.entry,
      id: mutation.id,
      version: (mutation.version ?? 0) + 1,
    });
  }
  return receipt;
}

export async function knowledgeCommitRoundTrip(kind: KnowledgeKind, mode: KnowledgeCommitFixture) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home);
    try {
      const commit = newPublication(kind);
      const initial = await assertPublication(hub, commit);
      assert.deepEqual(await hub.commit(commit), initial);
      const second: KnowledgeCommit = {
        publication_id: newId(),
        mutations: commit.mutations.map((mutation) => ({
          ...mutation,
          version: 1,
          entry: { ...knowledgeDraft(kind), body: "Changed committed knowledge" },
        })),
      };
      const tail = second.mutations[1];
      assert.ok(tail);
      if (mode === KnowledgeCommitFixture.Mixed) tail.entry = null;
      const updated = await assertPublication(hub, second);
      assert.notEqual(updated.revision, initial.revision);
      assert.deepEqual(await hub.commit(commit), initial);
      assert.equal((await hub.get(firstMutation(commit).id)).revision, updated.revision);
      const search = await hub.search({ kind });
      assert.equal(search.revision, updated.revision);
      assert.equal(search.results.length, mode === KnowledgeCommitFixture.Mixed ? 1 : 2);
      const history = join(rootPath(home), KnowledgeFile.History, kind);
      for (const mutation of commit.mutations)
        assert.ok(await exists(join(history, mutation.id, String(1) + KnowledgeFile.Markdown)));
      await hub.close();
      hub = await KnowledgeHub.open(home, { max_publication_entries: 1, max_publication_bytes: 1 });
      assert.deepEqual(await hub.commit(commit), initial);
      assert.deepEqual(await hub.commit(second), updated);
      assert.equal((await hub.get(firstMutation(commit).id)).revision, updated.revision);
      assert.equal(await exists(journalPath(home)), false);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

async function refusedInput(hub: KnowledgeHub, mode: KnowledgeCommitFixture) {
  const first = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
  const second = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
  const commit: KnowledgeCommit = {
    publication_id: newId(),
    mutations: [first, second].map((result) => ({
      id: result.entry.id,
      version: 1,
      entry: { ...knowledgeDraft(KnowledgeKind.Fact), body: "Unpublished change" },
    })),
  };
  const last = lastMutation(commit);
  if (mode === KnowledgeCommitFixture.Conflict) last.version = 2;
  if (mode === KnowledgeCommitFixture.Duplicate) last.id = first.entry.id;
  if (mode === KnowledgeCommitFixture.Kind) last.entry = knowledgeDraft(KnowledgeKind.Lesson);
  if (mode === KnowledgeCommitFixture.Missing) last.id = newId();
  if (mode === KnowledgeCommitFixture.Add) last.version = null;
  if (mode === KnowledgeCommitFixture.Persona) {
    const persona = await hub.add(knowledgeDraft(KnowledgeKind.Persona));
    last.id = persona.entry.id;
    last.entry = null;
  }
  return { first, second, commit };
}

export async function knowledgeCommitRefusal(mode: KnowledgeCommitFixture, code: ErrorCode) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const { first, second, commit } = await refusedInput(hub, mode);
      await assert.rejects(hub.commit(commit), { code });
      assert.deepEqual((await hub.get(first.entry.id)).entry, first.entry);
      assert.deepEqual((await hub.get(second.entry.id)).entry, second.entry);
      assert.equal(await exists(journalPath(home)), false);
      assert.equal(await exists(receiptPath(home, commit.publication_id)), false);
      assert.equal((await hub.add(knowledgeDraft(KnowledgeKind.Lesson))).entry.version, 1);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeCommitAdmission(field: keyof KnowledgeSettings, allowed: boolean) {
  async function observe(home: string) {
    const settings = {
      max_entries: allowed ? 2 : 1,
      max_total_bytes: allowed ? 4096 : 200,
      max_index_bytes: allowed ? 4096 : 300,
      max_publication_entries: allowed ? 2 : 1,
      max_publication_bytes: allowed ? 4096 : 1,
    };
    const hub = await KnowledgeHub.open(home, { [field]: Reflect.get(settings, field) });
    try {
      const commit = newPublication(KnowledgeKind.Fact);
      if (allowed) await assertPublication(hub, commit);
      else {
        await assert.rejects(hub.commit(commit), {
          code: field === "max_publication_bytes" ? ErrorCode.StreamLimit : ErrorCode.Capacity,
        });
        await assertMissing(hub, commit.mutations);
        assert.equal(await exists(journalPath(home)), false);
        assert.equal(await exists(receiptPath(home, commit.publication_id)), false);
        assert.ok(await hub.reindex());
      }
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeCommitReplacement(kind: KnowledgeKind, reverse: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home, { max_entries: 1 });
    try {
      const first = await hub.add(knowledgeDraft(kind));
      const commit = newPublication(kind);
      commit.mutations[1] = { id: first.entry.id, version: 1, entry: null };
      if (reverse) commit.mutations.reverse();
      await assertPublication(hub, commit);
      assert.equal((await hub.reindex()).entries, 1);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeCommitRecovery(
  stage: KnowledgePublicationStage,
  occurrence: number,
  remove: boolean,
) {
  async function observe(home: string) {
    let armed = false;
    let seen = 0;
    let hub = await KnowledgeHub.open(home, {}, async (current) => {
      if (armed && current === stage && ++seen === occurrence)
        throw new Error("Interrupted set publication");
    });
    try {
      const commit = newPublication(KnowledgeKind.Fact);
      await assertPublication(hub, commit);
      const changed: KnowledgeCommit = {
        publication_id: newId(),
        mutations: commit.mutations.map((mutation) => ({
          ...mutation,
          version: 1,
          entry: remove
            ? null
            : { ...knowledgeDraft(KnowledgeKind.Fact), body: "Recovered complete publication" },
        })),
      };
      armed = true;
      await assert.rejects(hub.commit(changed), { message: "Interrupted set publication" });
      await assert.rejects(hub.reindex(), { code: ErrorCode.KnowledgeUnavailable });
      assert.equal(await exists(journalPath(home)), true);
      await hub.close();
      hub = await KnowledgeHub.open(home);
      const receipt = await assertPublication(hub, changed);
      assert.deepEqual(await hub.commit(changed), receipt);
      assert.equal((await hub.search({ kind: KnowledgeKind.Fact })).results.length, remove ? 0 : 2);
      assert.equal(await exists(journalPath(home)), false);
      assert.deepEqual(
        KnowledgePublicationReceiptSchema.parse(
          JSON.parse(
            (
              await readFileBytes(
                receiptPath(home, changed.publication_id),
                KnowledgeLimit.ReceiptBytes,
              )
            ).toString(),
          ),
        ),
        receipt,
      );
      for (const mutation of commit.mutations)
        assert.ok(
          await exists(
            join(
              rootPath(home),
              KnowledgeFile.History,
              KnowledgeKind.Fact,
              mutation.id,
              String(1) + KnowledgeFile.Markdown,
            ),
          ),
        );
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeCommitReceipt(mode: KnowledgeCommitFixture) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home, { max_publication_receipts: 1 });
    try {
      const commit = newPublication(KnowledgeKind.Fact);
      const receipt = await assertPublication(hub, commit);
      const changed = structuredClone(commit);
      firstMutation(changed).entry = knowledgeDraft(KnowledgeKind.Lesson);
      await assert.rejects(hub.commit(changed), { code: ErrorCode.KnowledgeConflict });
      await assert.rejects(hub.commit(newPublication(KnowledgeKind.Lesson)), {
        code: ErrorCode.Capacity,
      });
      assert.deepEqual(await hub.commit(commit), receipt);
      const path = receiptPath(home, commit.publication_id);
      if (mode === KnowledgeCommitFixture.Receipt) await writeFile(path, "{");
      if (mode === KnowledgeCommitFixture.ReceiptShape) await writeFile(path, "{}");
      if (mode === KnowledgeCommitFixture.ReceiptId)
        await writeFile(path, JSON.stringify({ ...receipt, publication_id: newId() }));
      if (mode === KnowledgeCommitFixture.ReceiptChanges)
        await writeFile(
          path,
          JSON.stringify({ ...receipt, changes: [{ ...receipt.changes[0], version: 2 }] }),
        );
      await assert.rejects(hub.commit(commit), { code: ErrorCode.KnowledgeCorrupt });
      await writeFile(path, JSON.stringify(receipt));
      await hub.close();
      hub = await KnowledgeHub.open(home, { max_publication_receipts: 1 });
      assert.deepEqual(await hub.commit(commit), receipt);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeCommitCorruption(mode: KnowledgeCommitFixture) {
  async function observe(home: string) {
    let armed = false;
    let hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (armed && stage === KnowledgePublicationStage.Journal) throw new Error("Journal saved");
    });
    const commit = newPublication(KnowledgeKind.Fact);
    await assertPublication(hub, commit);
    const changed: KnowledgeCommit = {
      publication_id: newId(),
      mutations: commit.mutations.map((mutation) => ({ ...mutation, version: 1 })),
    };
    armed = true;
    await assert.rejects(hub.commit(changed), { message: "Journal saved" });
    await hub.close();
    const bytes = await readFileBytes(journalPath(home), KnowledgeLimit.PublicationBytes);
    const journal = KnowledgePublicationJournalSchema.parse(JSON.parse(bytes.toString()));
    if (mode === KnowledgeCommitFixture.Digest) journal.input_hash = "0".repeat(64);
    if (mode === KnowledgeCommitFixture.Before)
      lastChange(journal).before_text = "Changed original";
    if (mode === KnowledgeCommitFixture.Duplicate) journal.changes[1] = firstChange(journal);
    await writeFile(journalPath(home), JSON.stringify(journal));
    if (mode === KnowledgeCommitFixture.Current)
      await writeFile(
        entryPath(home, KnowledgeKind.Fact, lastMutation(commit).id),
        "Unexpected file",
      );
    if (mode === KnowledgeCommitFixture.ReceiptCollision) {
      const originalReceipt = KnowledgePublicationReceiptSchema.parse(
        JSON.parse(
          (
            await readFileBytes(
              receiptPath(home, commit.publication_id),
              KnowledgeLimit.ReceiptBytes,
            )
          ).toString(),
        ),
      );
      await writeFile(
        receiptPath(home, changed.publication_id),
        JSON.stringify({
          ...originalReceipt,
          publication_id: changed.publication_id,
          input_hash: journal.input_hash,
          changes: originalReceipt.changes.map((change) => ({ ...change, version: 2 })),
        }),
      );
    }
    const error = await thrownBy(async () => {
      hub = await KnowledgeHub.open(home);
    });
    assert.equal(await exists(journalPath(home)), true);
    if (mode !== KnowledgeCommitFixture.ReceiptCollision)
      assert.equal(
        (
          await readFileBytes(
            entryPath(home, KnowledgeKind.Fact, firstMutation(commit).id),
            KnowledgeLimit.EntryBytes,
          )
        ).toString(),
        knowledgeBytes(
          { ...knowledgeDraft(KnowledgeKind.Fact), id: firstMutation(commit).id, version: 1 },
          KnowledgeLimit.EntryBytes,
        ).toString(),
      );
    await writeFile(journalPath(home), bytes);
    await writeFile(
      entryPath(home, KnowledgeKind.Fact, lastMutation(commit).id),
      knowledgeBytes(
        { ...knowledgeDraft(KnowledgeKind.Fact), id: lastMutation(commit).id, version: 1 },
        KnowledgeLimit.EntryBytes,
      ),
    );
    if (mode === KnowledgeCommitFixture.ReceiptCollision)
      await rm(receiptPath(home, changed.publication_id));
    hub = await KnowledgeHub.open(home);
    try {
      await assertPublication(hub, changed);
    } finally {
      await hub.close();
    }
    return error instanceof Error && "code" in error ? error.code : null;
  }
  return withTemporaryDirectory(observe);
}

function firstMutation(commit: KnowledgeCommit) {
  const mutation = commit.mutations[0];
  assert.ok(mutation);
  return mutation;
}
function lastMutation(commit: KnowledgeCommit) {
  const mutation = commit.mutations[1];
  assert.ok(mutation);
  return mutation;
}
function firstChange(journal: KnowledgePublicationJournal) {
  const change = journal.changes[0];
  assert.ok(change);
  return change;
}
function lastChange(journal: KnowledgePublicationJournal) {
  const change = journal.changes[1];
  assert.ok(change);
  return change;
}
