import { strict as assert } from "node:assert";
import { link, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { IoLimit, KnowledgeFile, KnowledgeFileFixture, KnowledgeKind } from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub, knowledgeBytes } from "@titan/knowledge";
import { readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { KnowledgeEntry } from "@titan/types";
import { knowledgeDraft } from "./knowledge.ts";

async function corruptKnowledge(home: string, mode: KnowledgeFileFixture, entry: KnowledgeEntry) {
  const root = join(home, KnowledgeFile.Directory);
  const file = join(root, entry.kind, entry.id + KnowledgeFile.Markdown);
  const journal = join(root, KnowledgeFile.Journal);
  const database = join(home, KnowledgeFile.Database);
  if (mode === KnowledgeFileFixture.Rebuild) await rm(database);
  if (mode === KnowledgeFileFixture.Journal) await writeFile(journal, "{");
  if (mode === KnowledgeFileFixture.Before) {
    const before = knowledgeBytes(
      { ...entry, body: "Changed original text" },
      IoLimit.DataBytes,
    ).toString();
    await writeFile(
      journal,
      JSON.stringify({ before: entry, before_text: before, after: { ...entry, version: 2 } }),
    );
  }
  if (mode === KnowledgeFileFixture.Entry)
    await writeFile(file, knowledgeBytes({ ...entry, id: newId() }, IoLimit.DataBytes));
  if (mode === KnowledgeFileFixture.MalformedEntry) await writeFile(file, "{");
  if (
    [
      KnowledgeFileFixture.LinkedJournal,
      KnowledgeFileFixture.LinkedDatabase,
      KnowledgeFileFixture.SharedDatabase,
    ].includes(mode)
  ) {
    const outside = join(home, "external-file");
    await writeFile(outside, "External bytes");
    const target = mode === KnowledgeFileFixture.LinkedJournal ? journal : database;
    await rm(target, { force: true });
    if (mode === KnowledgeFileFixture.SharedDatabase) await link(outside, target);
    else await symlink(outside, target);
  }
}

export async function knowledgeFileRecovery(mode: KnowledgeFileFixture) {
  async function observe(home: string) {
    let hub = await KnowledgeHub.open(home);
    const original = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
    await hub.close();
    await corruptKnowledge(home, mode, original.entry);
    let reopened: KnowledgeHub | undefined;
    const error = await thrownBy(async () => {
      reopened = await KnowledgeHub.open(home);
    });
    if (reopened) {
      hub = reopened;
      try {
        assert.deepEqual(await hub.get(original.entry.id), original);
      } finally {
        await hub.close();
      }
      return true;
    }
    if (
      [
        KnowledgeFileFixture.LinkedJournal,
        KnowledgeFileFixture.LinkedDatabase,
        KnowledgeFileFixture.SharedDatabase,
      ].includes(mode)
    )
      assert.equal(
        (await readFileBytes(join(home, "external-file"), IoLimit.DataBytes)).toString(),
        "External bytes",
      );
    await rm(join(home, KnowledgeFile.Directory, KnowledgeFile.Journal), { force: true });
    await rm(join(home, KnowledgeFile.Database), { force: true });
    await writeFile(
      join(
        home,
        KnowledgeFile.Directory,
        original.entry.kind,
        original.entry.id + KnowledgeFile.Markdown,
      ),
      knowledgeBytes(original.entry, IoLimit.DataBytes),
    );
    hub = await KnowledgeHub.open(home);
    try {
      assert.deepEqual(await hub.get(original.entry.id), original);
    } finally {
      await hub.close();
    }
    throw error;
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeSearchBudget(count: number, expanded: boolean) {
  async function observe(home: string) {
    const hub = await KnowledgeHub.open(home);
    try {
      const tags = expanded ? Array.from({ length: 32 }, () => "界".repeat(64)) : [];
      for (let index = 0; index < count; index++)
        await hub.add({ ...knowledgeDraft(KnowledgeKind.Fact), tags });
      const page = await hub.search({ question: "time zones", limit: 200 });
      assert.ok(page.results.length > 0);
      assert.ok(page.results.length <= count);
      return page.truncated;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
