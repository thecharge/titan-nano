import { expect } from "bun:test";
import { mkdir, readdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ErrorCode,
  KnowledgeAttemptFile,
  KnowledgeAttemptState,
  KnowledgeKind,
  KnowledgePendingOperation,
  KnowledgeScope,
  KnowledgeState,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import {
  inspectKnowledge,
  inspectPendingKnowledge,
  KnowledgeHub,
  projectHubHome,
  ScopedKnowledgeHub,
} from "@titan/knowledge";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type KnowledgeMutation, ScopedKnowledgeListResultSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { knowledgeDraft } from "./knowledge.ts";
import { knowledgeAttemptPath, knowledgeAttemptScope } from "./knowledge-attempts.ts";

export async function pendingInspection(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    const scope = knowledgeAttemptScope();
    const saved = await hub.add(knowledgeDraft(KnowledgeKind.Lesson));
    const mutations: KnowledgeMutation[] = [
      { id: newId(), version: null, entry: knowledgeDraft(KnowledgeKind.Fact) },
      { id: saved.entry.id, version: 1, entry: knowledgeDraft(KnowledgeKind.Lesson) },
      { id: newId(), version: null, entry: knowledgeDraft(KnowledgeKind.Fact) },
    ];
    if (mode === "delete") mutations.splice(1, 1, { id: saved.entry.id, version: 1, entry: null });
    const document = await hub.attempts.stage(scope, { revision: null, mutations });
    if (mode === "discarded") await hub.attempts.discard(scope, 1);
    if (mode === "published") await hub.attempts.publish(scope, 1);
    await hub.close();
    const path = knowledgeAttemptPath(home, scope);
    if (mode === "prepared")
      await writeFile(path, JSON.stringify({ ...document, state: KnowledgeAttemptState.Prepared }));
    if (mode === "crossed")
      await rename(path, join(home, KnowledgeAttemptFile.Directory, "other.json"));
    if (mode === "linked") {
      await rename(path, `${path}.saved`);
      await symlink(`${path}.saved`, path);
    }
    if (mode === "invalid") await writeFile(path, "{}");
    if (mode === "temporary") await writeFile(`${path}.scratch.tmp`, "incomplete");
    if (mode === "extension") await writeFile(`${path}.other`, "unrecognized");
    if (mode === "directory") await mkdir(`${path}.directory`);
    const expected =
      mode === "capacity"
        ? ErrorCode.Capacity
        : ["crossed", "linked", "extension", "directory", "entries", "bytes"].includes(mode)
          ? ErrorCode.KnowledgeCorrupt
          : undefined;
    const before = await readFile(join(home, "knowledge.db"));
    const error = await thrownBy(async () => {
      const page = await inspectPendingKnowledge(
        home,
        mode === "kind"
          ? { kind: KnowledgeKind.Lesson }
          : mode === "tag"
            ? { tag: "absent" }
            : mode === "limit"
              ? { limit: 1 }
              : {},
        mode === "capacity"
          ? { attempts: { max_sets: 1 } }
          : mode === "entries"
            ? { attempts: { max_entries: 1 } }
            : mode === "bytes"
              ? { attempts: { max_bytes: 1 } }
              : {},
      );
      if (mode === "discarded" || mode === "published" || mode === "tag")
        expect(page.entries).toEqual([]);
      else {
        expect(page.entries.length).toBe(mode === "limit" || mode === "kind" ? 1 : 3);
        expect(page.entries[0]?.attempt).toEqual(scope);
        expect(page.entries.every((entry) => !("body" in entry))).toBe(true);
        if (mode === "delete")
          expect(page.entries.find((entry) => entry.id === saved.entry.id)?.operation).toBe(
            KnowledgePendingOperation.Delete,
          );
        if (mode === "normal")
          expect(page.entries.map((entry) => entry.operation)).toEqual([
            KnowledgePendingOperation.Add,
            KnowledgePendingOperation.Update,
            KnowledgePendingOperation.Add,
          ]);
        expect(page.truncated).toBe(mode === "limit");
      }
    });
    if (mode === "capacity") {
      expect(error).toBeUndefined();
      await writeFile(`${path}.scratch.tmp`, "incomplete");
      const full = await thrownBy(() =>
        inspectPendingKnowledge(home, {}, { attempts: { max_sets: 1 } }),
      );
      expect(full instanceof TitanError && full.code === expected).toBe(true);
    } else if (expected) expect(error instanceof TitanError && error.code === expected).toBe(true);
    else if (mode === "invalid") expect(error).toBeDefined();
    else expect(error).toBeUndefined();
    expect(await readFile(join(home, "knowledge.db"))).toEqual(before);
    if (!["crossed", "linked", "invalid", "prepared", "discarded", "published"].includes(mode))
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual(document);
    return true;
  });
}

export async function pendingScope(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const home = join(root, "home");
    const project = join(root, "project");
    if (mode === "root-file" || mode === "root-link") {
      await mkdir(home);
      const directory = join(home, KnowledgeAttemptFile.Directory);
      if (mode === "root-file") await writeFile(directory, "invalid directory");
      else await symlink(root, directory);
      const error = await thrownBy(() => inspectPendingKnowledge(home));
      expect(error instanceof TitanError && error.code === ErrorCode.KnowledgeCorrupt).toBe(true);
      return true;
    }
    if (mode === "missing" || mode === "empty") {
      if (mode === "empty") await mkdir(home);
      expect(await inspectPendingKnowledge(home)).toEqual({ entries: [], truncated: false });
      expect(await readdir(mode === "missing" ? root : home)).toEqual([]);
      return true;
    }
    const scoped = await ScopedKnowledgeHub.open(project, home);
    const scope = knowledgeAttemptScope();
    const id = newId();
    const first = scoped.project as KnowledgeHub;
    const second = scoped.home as KnowledgeHub;
    await first.attempts.stage(scope, {
      revision: null,
      mutations: [{ id, version: null, entry: knowledgeDraft(KnowledgeKind.Fact) }],
    });
    await first.attempts.stage(
      { ...scope, candidate_id: newId() },
      {
        revision: null,
        mutations: [{ id, version: null, entry: knowledgeDraft(KnowledgeKind.Lesson) }],
      },
    );
    await second.attempts.stage(scope, {
      revision: null,
      mutations: [{ id, version: null, entry: knowledgeDraft(KnowledgeKind.Fact) }],
    });
    const pending = await scoped.list({ state: KnowledgeState.Pending });
    expect(pending.entries).toHaveLength(3);
    expect(pending.entries.filter((entry) => entry.scope === KnowledgeScope.Project)).toHaveLength(
      2,
    );
    expect((await scoped.list()).entries).toEqual([]);
    if (mode === "scoped")
      expect(
        (await scoped.list({ state: KnowledgeState.Pending, scope: KnowledgeScope.Home })).entries,
      ).toHaveLength(1);
    if (mode === "limited")
      expect((await scoped.list({ state: KnowledgeState.Pending, limit: 1 })).truncated).toBe(true);
    await scoped.close();
    if (mode === "unavailable") {
      const view = ScopedKnowledgeHub.join(
        await inspectKnowledge(projectHubHome(project)),
        await inspectKnowledge(home),
      );
      const error = await thrownBy(() => view.list({ state: KnowledgeState.Pending }));
      expect(error instanceof TitanError && error.code === ErrorCode.NotBuilt).toBe(true);
    }
    if (mode === "cli" || mode === "cli-home") {
      let result: unknown;
      await createCli({
        ...defaultServices,
        output: (value) => {
          result = value;
        },
      })([
        "kb",
        "list",
        "--state",
        "pending",
        "--scope",
        mode === "cli" ? "project" : "home",
        "--home",
        home,
        "--project",
        project,
        "--json",
      ]);
      const shown = ScopedKnowledgeListResultSchema.parse(result);
      expect(shown.entries).toHaveLength(mode === "cli" ? 2 : 1);
      expect(
        shown.entries.every(
          (entry) =>
            entry.state === KnowledgeState.Pending && entry.attempt?.run_id === scope.run_id,
        ),
      ).toBe(true);
    }
    return true;
  });
}
