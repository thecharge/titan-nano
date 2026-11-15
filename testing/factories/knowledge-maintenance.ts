import { strict as assert } from "node:assert";
import { readFile, rename, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  KnowledgeCommand,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeMaintenanceReason,
  type KnowledgePublicationStage,
} from "@titan/constants";
import { newId } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { startServer } from "@titan/server";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { KnowledgeDraftSchema, KnowledgeMaintenanceResultSchema, ObjectSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";

export async function knowledgeMaintenance(mode: string) {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    try {
      const first = await hub.add({
        kind: KnowledgeKind.Fact,
        title: "First",
        body: "Retained source text",
        tags: ["one"],
      });
      const second = await hub.add({
        kind: KnowledgeKind.Fact,
        title: "Second",
        body: "Retained source text",
        tags: ["two"],
      });
      const root = join(home, KnowledgeFile.Directory);
      const firstPath = join(root, KnowledgeKind.Fact, first.entry.id + KnowledgeFile.Markdown);
      const original = await readFile(firstPath);
      if (mode === "active") {
        await assert.rejects(hub.restore(first.entry.id));
        return true;
      }
      if (mode === "missing") {
        await assert.rejects(hub.restore(newId()));
        return true;
      }
      if (mode === "invalid") {
        await assert.rejects(hub.maintenance(KnowledgeCommand.Prune, { before: "yesterday" }));
        return true;
      }
      if (mode.startsWith("old-")) {
        const different = await hub.add({
          kind: KnowledgeKind.Fact,
          title: "Old",
          body: "Independent old text",
        });
        const path = join(root, KnowledgeKind.Fact, different.entry.id + KnowledgeFile.Markdown);
        await utimes(path, new Date(0), new Date(0));
        if (mode === "old-read") await hub.get(different.entry.id);
        const report = await hub.maintenance(KnowledgeCommand.Prune, {});
        assert.equal(
          report.candidates.some(
            (entry) =>
              entry.id === different.entry.id && entry.reason === KnowledgeMaintenanceReason.Unread,
          ),
          mode === "old-unread",
        );
        return true;
      }
      if (mode.startsWith("replaced")) {
        await hub.update({
          id: first.entry.id,
          version: 1,
          entry: {
            ...KnowledgeDraftSchema.strip().parse(first.entry),
            body: "Updated source text",
          },
        });
        if (mode === "replaced-missing") {
          await rm(
            join(
              root,
              KnowledgeFile.History,
              KnowledgeKind.Fact,
              first.entry.id,
              `1${KnowledgeFile.Markdown}`,
            ),
          );
          await assert.rejects(hub.maintenance(KnowledgeCommand.Prune, {}));
          return true;
        }
        const report = await hub.maintenance(KnowledgeCommand.Prune, {});
        assert(
          report.candidates.some(
            (entry) => entry.id === first.entry.id && entry.retained && entry.version === 1,
          ),
        );
        return true;
      }
      const operation = mode.startsWith("consolidate")
        ? KnowledgeCommand.Consolidate
        : KnowledgeCommand.Prune;
      const plan = await hub.maintenance(operation, {});
      assert.equal(plan.applied, false);
      assert.equal(plan.groups.length, 1);
      assert.equal(plan.candidates.length, 1);
      assert.deepEqual(await readFile(firstPath), original);
      assert.equal((await hub.stats()).entries, 2);
      if (mode.endsWith("report")) return true;
      const result = await hub.maintenance(operation, { apply: true });
      assert(result.applied);
      assert.equal(result.publications.length, 1);
      if (operation === KnowledgeCommand.Consolidate) {
        const found = await hub.search({ kind: KnowledgeKind.Fact });
        assert.equal(found.results.length, 1);
        const kept = await hub.get(found.results[0]?.id ?? "");
        assert(kept.entry.body.includes(first.entry.id));
        assert(kept.entry.body.includes(second.entry.id));
        assert.deepEqual([...kept.entry.tags].sort(), ["one", "two"]);
        assert.equal((await hub.stats()).entries, 1);
        await hub.reindex();
        assert.equal((await hub.search({ question: "Retained source" })).results.length, 1);
        await hub.restore(first.entry.id);
        await hub.restore(second.entry.id);
        return true;
      }
      const removed = plan.candidates[0];
      assert(removed);
      const archive = join(
        root,
        KnowledgeFile.History,
        KnowledgeKind.Fact,
        removed.id,
        "1" + KnowledgeFile.Markdown,
      );
      assert(await exists(archive));
      assert((await readFile(archive, "utf8")).includes("Retained source text"));
      if (mode.startsWith("archive-")) {
        const parent = join(root, KnowledgeFile.History, KnowledgeKind.Fact, removed.id);
        if (mode === "archive-linked") {
          await rename(parent, parent + ".original");
          await symlink(parent + ".original", parent);
        }
        if (mode === "archive-empty") await rm(archive);
        if (mode === "archive-invalid") await writeFile(join(parent, "invalid.md"), "invalid");
        if (mode === "archive-changed") await writeFile(archive, "changed archived entry");
        await assert.rejects(hub.restore(removed.id));
        assert.equal((await hub.stats()).entries, 1);
        return true;
      }
      if (mode === "reuse") {
        await assert.rejects(hub.add({ ...second.entry, id: removed.id }));
        return true;
      }
      const restored = await hub.restore(removed.id);
      assert.equal(restored.entry.version, 2);
      assert.equal(restored.entry.body, "Retained source text");
      await hub.update({
        id: removed.id,
        version: 2,
        entry: { kind: KnowledgeKind.Fact, title: "Restored", body: "Updated after restore" },
      });
      assert.equal((await hub.history({ id: removed.id })).entries.length, 2);
      await hub.reindex();
      assert.equal((await hub.stats()).entries, 2);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function knowledgeMaintenanceSurface(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const home = join(directory, "home");
    const project = join(directory, "project");
    const server = await startServer(home, createFakeBackend);
    try {
      const client = createKnowledgeClient(home);
      const first = await client.add({
        kind: KnowledgeKind.Fact,
        title: "One",
        body: "Shared retained text",
      });
      await client.add({ kind: KnowledgeKind.Fact, title: "Two", body: "Shared retained text" });
      if (mode === "http-missing") {
        await assert.rejects(client.restore(newId()));
        return true;
      }
      if (mode === "http-invalid") {
        await assert.rejects(client.maintenance(KnowledgeCommand.Prune, { apply: "yes" }));
        return true;
      }
      if (mode === "http") {
        const plan = await client.maintenance(KnowledgeCommand.Consolidate, {});
        assert.equal(plan.groups.length, 1);
        const applied = await client.maintenance(KnowledgeCommand.Consolidate, { apply: true });
        assert(applied.applied);
        assert.equal((await client.restore(first.entry.id)).entry.version, 2);
        return true;
      }
      let output: unknown;
      const cli = createCli({
        ...defaultServices,
        output: (value) => {
          output = value;
        },
      });
      const args = ["--home", home, "--project", project, "--json"];
      if (mode === "cli-invalid") {
        await assert.rejects(cli(["kb", "prune", "--before", "yesterday", ...args]));
        return true;
      }
      const scope = mode === "cli-home" ? ["--scope", "home"] : [];
      if (!scope.length) {
        const path = join(directory, "source.md");
        await writeFile(path, "---\nkind: fact\ntitle: Shared\n---\nProject retained text");
        await cli(["kb", "add", path, ...args]);
        await cli(["kb", "add", path, ...args]);
      }
      await cli(["kb", "prune", ...scope, ...args]);
      const { scope: actualScope, ...reported } = ObjectSchema.parse(output);
      const report = KnowledgeMaintenanceResultSchema.parse(reported);
      assert.equal(actualScope, mode === "cli-home" ? "home" : "project");
      assert.equal(report.candidates.length, 1);
      await cli(["kb", "prune", "--apply", ...scope, ...args]);
      const removed = report.candidates[0];
      assert(removed);
      await cli(["kb", "restore", removed.id, ...scope, ...args]);
      await cli(["kb", "consolidate", "--apply", ...scope, ...args]);
      const { scope: joinedScope, ...consolidated } = ObjectSchema.parse(output);
      assert.equal(joinedScope, actualScope);
      assert.equal(KnowledgeMaintenanceResultSchema.parse(consolidated).publications.length, 1);
      return true;
    } finally {
      await server.stop();
    }
  });
}

export async function knowledgeMaintenanceRecovery(stage: KnowledgePublicationStage) {
  return withTemporaryDirectory(async (home) => {
    let interrupt = false;
    let hub = await KnowledgeHub.open(home, {}, async (current) => {
      if (interrupt && current === stage) throw new Error("Interrupted restore");
    });
    try {
      const original = await hub.add({
        kind: KnowledgeKind.Fact,
        title: "Restore",
        body: "Full archived source",
      });
      await hub.delete({ id: original.entry.id, version: 1 });
      interrupt = true;
      await assert.rejects(hub.restore(original.entry.id));
      await hub.close();
      hub = await KnowledgeHub.open(home);
      const restored = await hub.get(original.entry.id);
      assert.equal(restored.entry.version, 2);
      assert.equal(restored.entry.body, original.entry.body);
      assert.deepEqual((await hub.history({ id: original.entry.id })).entries, [original.entry]);
      await hub.reindex();
      assert.equal((await hub.stats()).entries, 1);
      return true;
    } finally {
      await hub.close();
    }
  });
}
