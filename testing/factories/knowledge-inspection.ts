import { expect } from "bun:test";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ErrorCode, KnowledgeFile, KnowledgeKind, KnowledgeSearchMode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { inspectKnowledge, KnowledgeHub } from "@titan/knowledge";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { knowledgeDraft } from "./knowledge.ts";

export async function knowledgeInspection(kind: KnowledgeKind, mutate: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    const initial = await hub.add(knowledgeDraft(kind));
    await hub.close();
    const path = join(home, KnowledgeFile.Database);
    const before = await readFile(path);
    const view = await inspectKnowledge(
      home,
      mutate ? { name: "test", embed: async () => [1] } : undefined,
    );
    const stats = await view.stats();
    expect(stats.never_read).toBe(1);
    const page = await view.search({ kind, mode: KnowledgeSearchMode.Words });
    const shown = await view.get(initial.entry.id);
    expect(page.results[0]?.id).toBe(initial.entry.id);
    expect(shown.entry).toEqual(initial.entry);
    if (mutate) {
      const actions = [
        () => view.add(knowledgeDraft(kind)),
        () => view.update({ id: initial.entry.id, version: 1, entry: knowledgeDraft(kind) }),
        () => view.delete({ id: initial.entry.id, version: 1 }),
        () => view.reindex(),
        () => view.search({ question: "time zones", mode: KnowledgeSearchMode.Words }),
      ];
      for (const action of actions) {
        const error = await thrownBy(action);
        expect(error instanceof TitanError && error.code === ErrorCode.PermissionDenied).toBe(true);
      }
    }
    expect((await view.stats()).never_read).toBe(1);
    expect(await readFile(path)).toEqual(before);
    const reopened = await KnowledgeHub.open(home);
    try {
      return (await reopened.stats()).never_read === 1;
    } finally {
      await reopened.close();
    }
  });
}

export async function missingInspection(nested: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const home = nested ? join(root, "absent") : root;
    const view = await inspectKnowledge(home);
    expect((await view.stats()).entries).toBe(0);
    expect(
      (await view.search({ kind: KnowledgeKind.Fact, mode: KnowledgeSearchMode.Words })).results,
    ).toEqual([]);
    return (await readdir(root)).length === 0;
  });
}

export async function inspectionAdmission(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    const first = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
    const second = await hub.add(knowledgeDraft(KnowledgeKind.Lesson));
    await hub.close();
    if (mode === "changed") {
      const path = join(
        home,
        KnowledgeFile.Directory,
        KnowledgeKind.Fact,
        first.entry.id + KnowledgeFile.Markdown,
      );
      await writeFile(
        path,
        (await readFile(path, "utf8")).replace(
          "Check time zones first",
          "Changed outside the indexed transaction",
        ),
      );
    }
    const error = await thrownBy(async () => {
      const view = await inspectKnowledge(
        home,
        undefined,
        mode === "capacity" ? { max_entries: 1 } : mode === "bytes" ? { max_index_bytes: 1 } : {},
      );
      if (mode === "missing") await view.get("00000000-0000-4000-8000-000000000000");
      else if (mode === "changed") await view.get(first.entry.id);
      else {
        expect((await view.stats()).entries).toBe(2);
        expect(
          (await view.get(mode === "lesson" ? second.entry.id : first.entry.id)).entry.version,
        ).toBe(1);
      }
    });
    const expected =
      mode === "capacity"
        ? ErrorCode.Capacity
        : mode === "bytes"
          ? ErrorCode.StreamLimit
          : mode === "missing"
            ? ErrorCode.KnowledgeMissing
            : mode === "changed"
              ? ErrorCode.KnowledgeCorrupt
              : null;
    if (expected === null) expect(error).toBeUndefined();
    else expect(error instanceof TitanError && error.code === expected).toBe(true);
    return true;
  });
}
