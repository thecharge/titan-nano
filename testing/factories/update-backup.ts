import { strict as assert } from "node:assert";
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rename,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardFile,
  ErrorCode,
  RunEventKind,
  ServerDatabaseAdapter,
  ServerFile,
  ServerSql,
  TitanRelease,
  UpdateBackupStage,
  UpdateFile,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { inspectUpdateCatalog } from "@titan/server/maintenance";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunEventSchema, UpdateBackupSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createUpdateBackup, verifyUpdateBackup } from "../../apps/cli/src/update-backup.ts";
import { createFakeBackend } from "../support/backend.ts";

export async function updateBackup(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const project = join(directory, "project", ".titan");
    const home =
      mode === "enclosed"
        ? join(project, "home")
        : mode === "deeply-enclosed"
          ? join(project, "nested", "home")
          : join(directory, "home");
    await mkdir(project, { recursive: true, mode: 0o700 });
    await mkdir(home, { recursive: true, mode: 0o700 });
    await mkdir(join(home, "backups", "earlier"), { recursive: true });
    await writeFile(join(home, "backups", "earlier", "record"), "earlier backup");
    const credential = join(home, "credential");
    await writeFile(credential, "retained private credential", { mode: 0o600 });
    await writeFile(join(project, "journal"), "retained project journal");
    await writeFile(join(project, "executable"), "retained executable");
    await chmod(join(project, "executable"), 0o750);
    await symlink("../missing", join(home, "relative-link"));
    await symlink(join(directory, "outside"), join(home, "absolute-link"));
    if (mode === "linked-root") {
      await symlink(project, join(directory, "linked"));
      await assert.rejects(() => createUpdateBackup(home, [join(directory, "linked")], "1.0.0"));
      assert.deepEqual(await readdir(join(home, "backups")), ["earlier"]);
      return true;
    }
    if (mode === "changed" || mode === "changed-back" || mode === "changed-after-verification") {
      await assert.rejects(
        () =>
          createUpdateBackup(home, [project], "1.0.0", async (stage, path) => {
            const expected =
              mode === "changed-after-verification"
                ? UpdateBackupStage.Verified
                : UpdateBackupStage.Copied;
            if (stage !== expected || path !== home) return;
            await writeFile(credential, "concurrent edit");
            if (mode === "changed-back") await writeFile(credential, "retained private credential");
          }),
        /changed files/,
      );
      assert.deepEqual(await readdir(join(home, "backups")), ["earlier"]);
      assert.equal(
        (await readdir(directory)).some((name) => name.startsWith(".titan-backup-")),
        false,
      );
      return true;
    }
    const backup = await createUpdateBackup(
      home,
      mode === "nested" ? [project, join(home, "backups"), project] : [project],
      "1.0.0",
    );
    const manifest = UpdateBackupSchema.parse(
      JSON.parse((await readFile(join(backup, UpdateFile.Manifest))).toString()),
    );
    assert.equal(manifest.roots.length, 2);
    const copiedHome = join(backup, "home");
    const copiedProject = join(backup, manifest.roots[1]?.copy ?? "missing");
    if (mode === "wrong-first-root" || mode === "duplicate-copy") {
      const first = manifest.roots[0];
      const second = manifest.roots[1];
      assert.ok(first && second);
      if (mode === "wrong-first-root") first.copy = "projects/2";
      else second.copy = first.copy;
      await writeFile(join(backup, UpdateFile.Manifest), JSON.stringify(manifest));
      await assert.rejects(() => verifyUpdateBackup(backup), { code: ErrorCode.Arguments });
      return true;
    }
    if (mode === "linked-copy") {
      const outside = join(directory, "retained-copy");
      await rename(copiedProject, outside);
      await symlink(outside, copiedProject);
      await assert.rejects(() => verifyUpdateBackup(backup), { code: ErrorCode.Arguments });
      assert.equal(
        (await readFile(join(outside, "journal"))).toString(),
        "retained project journal",
      );
      return true;
    }
    assert.equal((await lstat(backup)).mode & 0o777, 0o700);
    assert.equal((await lstat(join(copiedHome, "credential"))).mode & 0o777, 0o600);
    assert.equal((await lstat(join(copiedProject, "executable"))).mode & 0o777, 0o750);
    assert.equal(await readlink(join(copiedHome, "relative-link")), "../missing");
    assert.equal(await readlink(join(copiedHome, "absolute-link")), join(directory, "outside"));
    assert.equal(
      (await readFile(join(copiedHome, "backups", "earlier", "record"))).toString(),
      "earlier backup",
    );
    assert.equal(
      (await readFile(join(copiedProject, "journal"))).toString(),
      "retained project journal",
    );
    if (mode === "damaged") {
      await writeFile(join(copiedHome, "credential"), "changed backup");
      await assert.rejects(() => verifyUpdateBackup(backup), /changed files/);
      return true;
    }
    await verifyUpdateBackup(backup);
    assert.equal((await readFile(credential)).toString(), "retained private credential");
    return true;
  });
}

export async function createUpdateRun(
  home: string,
  project: string,
  submission = "backup-submission",
) {
  const run = await new Engine(createFakeBackend).create({
    project,
    plan: validateWorkflow(vendorRecoveryWorkflow()),
    config: await resolveConfig({ home, project }),
    backend: Backend.Fake,
    client_id: "backup-client",
    submission_id: submission,
  });
  const database = new Bun.SQL({
    adapter: ServerDatabaseAdapter,
    filename: join(home, ServerFile.Database),
  });
  try {
    for (const query of ServerSql.Initialize) await database.unsafe(query);
    await database.unsafe(ServerSql.Insert, [
      run.run_id,
      run.root,
      "backup-client",
      submission,
      "backup-hash",
    ]);
  } finally {
    await database.close();
  }
  return run;
}

export async function updateBackupJournal(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const home = join(directory, "home");
    const project = join(directory, "project");
    await mkdir(home);
    await mkdir(project);
    const run = await createUpdateRun(home, project);
    if (mode === "older" || mode === "mixed") {
      const retained =
        mode === "mixed" ? await createUpdateRun(home, project, "older-submission") : run;
      const path = join(retained.root, BoardFile.Journal);
      const event = RunEventSchema.parse(JSON.parse((await readFile(path)).toString().trim()));
      event.state.runtime_version = "0.0.1";
      await writeFile(path, `${JSON.stringify(event)}\n`);
    }
    if (mode === "linked-catalog" || mode === "linked-catalog-companion") {
      const source = join(home, ServerFile.Database);
      const target = join(directory, "external-catalog-target");
      if (mode === "linked-catalog") await rename(source, target);
      else await writeFile(target, "retained external database bytes", { mode: 0o644 });
      const before = await readFile(target);
      await symlink(target, mode === "linked-catalog" ? source : `${source}-shm`);
      await assert.rejects(() => inspectUpdateCatalog(home), { code: ErrorCode.Arguments });
      assert.deepEqual(await readFile(target), before);
      return true;
    }
    if (mode === "events") await new RunStore(run.root).commit(run, RunEventKind.Restart);
    if (mode === "changed-runtime" || mode === "future-format") {
      if (mode === "changed-runtime")
        await new RunStore(run.root).commit(run, RunEventKind.Restart);
      const path = join(run.root, BoardFile.Journal);
      const events = (await readFile(path))
        .toString()
        .trim()
        .split("\n")
        .map((line) => RunEventSchema.parse(JSON.parse(line)));
      const last = events.at(-1);
      assert.ok(last);
      if (mode === "changed-runtime") last.state.runtime_version = "0.0.1";
      else Reflect.set(last.state, "schema_version", 999);
      await writeFile(path, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
      const before = await readFile(path);
      const backup = await createUpdateBackup(home, [join(project, ".titan")], TitanRelease);
      await assert.rejects(() => verifyUpdateBackup(backup));
      assert.deepEqual(await readFile(path), before);
      return true;
    }
    const before = await readFile(join(run.root, BoardFile.Journal));
    const backup = await createUpdateBackup(home, [join(project, ".titan")], TitanRelease);
    const validated = await verifyUpdateBackup(backup);
    assert.deepEqual(validated.catalog.projects, [project]);
    assert.equal(validated.catalog.runs.includes(run.root), true);
    assert.equal(validated.catalog.runs.length, mode === "mixed" ? 2 : 1);
    const root = validated.backup.roots[1];
    assert.ok(root);
    if (mode === "missing-root") {
      validated.backup.roots = validated.backup.roots.slice(0, 1);
      await writeFile(join(backup, UpdateFile.Manifest), JSON.stringify(validated.backup));
      await assert.rejects(() => verifyUpdateBackup(backup), { code: ErrorCode.Arguments });
      assert.deepEqual(await readFile(join(run.root, BoardFile.Journal)), before);
      return true;
    }
    const copied = join(backup, root.copy, "runs", run.run_id);
    if (mode === "empty") {
      await writeFile(join(copied, BoardFile.Journal), "");
      await assert.rejects(
        () => new RunStore(run.root).inspectCopy(copied, TitanRelease),
        /Run not found/,
      );
    } else if (mode === "runtime")
      await assert.rejects(() => new RunStore(run.root).inspectCopy(copied, "999.0.0"), {
        code: ErrorCode.UnsupportedRunRuntime,
      });
    else
      assert.equal(
        (
          await new RunStore(run.root).inspectCopy(
            copied,
            mode === "older" ? "0.0.1" : TitanRelease,
          )
        ).run_id,
        run.run_id,
      );
    assert.deepEqual(await readFile(join(run.root, BoardFile.Journal)), before);
    return true;
  });
}
