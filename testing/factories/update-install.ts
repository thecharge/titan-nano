import { strict as assert } from "node:assert";
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  BoardFile,
  Packaging,
  ProcessSignal,
  SignalEvent,
  TestProcessLimit,
  TitanRelease,
  UpdateFile,
  UpdatePhase,
} from "@titan/constants";
import { hash } from "@titan/core";
import { captureCommand } from "@titan/process";
import { call, startServer } from "@titan/server";
import { assertUpdateSettled, ownMaintenance, ownOfflineHome } from "@titan/server/maintenance";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type UpdateTransaction, UpdateTransactionSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createUpdateBackup } from "../../apps/cli/src/update-backup.ts";
import { installUpdate } from "../../apps/cli/src/update-install.ts";
import { buildUpdateRelease } from "../../apps/cli/src/update-source.ts";
import { createFakeBackend, schemaFakeAnswer } from "../support/backend.ts";
import { aliasDaemonVersion } from "./daemon.ts";
import { checkedWorkflow } from "./hardening.ts";
import { createUpdateRun } from "./update-backup.ts";

export async function managedUpdate(directory: string) {
  const installation = join(directory, "installation");
  const release = join(installation, "releases", "titan-cli-original");
  const entry = join(release, Packaging.InstalledPath, Packaging.Bundle);
  await mkdir(dirname(entry), { recursive: true });
  await writeFile(entry, "original entry");
  const binary = join(release, Packaging.CliPath);
  await mkdir(dirname(binary));
  await symlink(entry, binary);
  const launcher = join(installation, "titan");
  const previous = "releases/titan-cli-original/node_modules/.bin/titan";
  await symlink(previous, launcher);
  const home = join(directory, "home");
  const project = join(directory, "project");
  await mkdir(home, { mode: 0o700 });
  await mkdir(join(project, ".titan"), { recursive: true });
  await writeFile(join(home, "credential"), "private credential", { mode: 0o600 });
  await writeFile(join(project, ".titan", "journal"), "private proposal and journal");
  return { installation, entry, launcher, previous, home, project };
}

async function releaseArchive(directory: string, mode: string, launcher: string) {
  const source = join(directory, "package");
  await mkdir(source);
  const main = resolve(import.meta.dir, "../../apps/cli/src/main.ts");
  const output = resolve(import.meta.dir, "../../apps/cli/src/output.ts");
  const code = [
    "#!/usr/bin/env bun",
    `import { runEntry } from ${JSON.stringify(main)};`,
    `import { outputEnvelope } from ${JSON.stringify(output)};`,
    `import { rm, symlink } from "node:fs/promises";`,
    `const mode = ${JSON.stringify(mode)};`,
    `if (process.argv.includes("--version")) console.log(JSON.stringify(outputEnvelope({version: mode === "older" ? "0.9.0" : mode === "wrong-release" ? "3.0.0" : "2.0.0"}, {operation:"version"})));`,
    `else if (mode === "failed" || mode === "journal-failed") process.exitCode = 1;`,
    `else if (mode === "malformed") console.log("invalid");`,
    `else if (mode === "missing-tool") console.log(JSON.stringify(outputEnvelope({prerequisites:[{name:"bun",required:true,ready:false,repair:"install"}]}, {operation:"doctor"})));`,
    `else { if (mode === "changed-launcher") { await rm(${JSON.stringify(launcher)}); await symlink("external-launcher", ${JSON.stringify(launcher)}); } process.exitCode = await runEntry(process.argv.slice(2)); }`,
  ].join("\n");
  await writeFile(join(source, "titan.js"), code);
  await chmod(join(source, "titan.js"), 0o755);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "@titan/cli",
      version: "2.0.0",
      type: "module",
      bin: { titan: "./titan.js" },
      files: ["titan.js"],
    }),
  );
  const packed = await captureCommand(
    [process.execPath, "pm", "pack", "--destination", directory],
    source,
  );
  assert.equal(packed.exit_code, 0, packed.stderr.toString());
  const archive = (await readdir(directory)).find((name) => name.endsWith(".tgz"));
  assert.ok(archive);
  return join(directory, archive);
}

async function updateSourceRepository(directory: string, archive: string, mode: string) {
  const repository = join(directory, "repository");
  await mkdir(repository);
  const commands = [
    ["git", "init"],
    ["git", "config", "user.name", "Titan test"],
    ["git", "config", "user.email", "titan@example.invalid"],
    ["git", "add", "."],
    [
      "git",
      "-c",
      "user.name=Titan test",
      "-c",
      "user.email=titan@example.invalid",
      "commit",
      "-m",
      "test: local release",
    ],
    ["git", "tag", ...(mode === "annotated" ? ["-a", "-m", "release"] : []), "v2.0.0"],
  ];
  await writeFile(
    join(repository, "package.json"),
    JSON.stringify({
      name: "titan-workspace",
      private: true,
      version: mode === "wrong-version" ? "1.9.0" : "2.0.0",
      scripts: { "pack:preview": "bun pack.ts" },
    }),
  );
  const code = `import {mkdir, copyFile} from "node:fs/promises"; await mkdir("dist", {recursive:true}); ${mode === "failed-build" ? "process.exit(1);" : `await copyFile(${JSON.stringify(archive)}, "dist/titan-cli-2.0.0.tgz");`} ${mode === "extra-archive" ? 'await copyFile("dist/titan-cli-2.0.0.tgz", "dist/titan-cli-extra.tgz");' : ""}`;
  await writeFile(join(repository, "pack.ts"), code);
  const first = commands.shift();
  assert.ok(first);
  assert.equal((await captureCommand(first, repository)).exit_code, 0);
  for (const command of commands) {
    const result = await captureCommand(command, repository);
    assert.equal(result.exit_code, 0, result.stderr.toString());
  }
  const object = await captureCommand(["git", "rev-parse", "refs/tags/v2.0.0"], repository);
  assert.equal(object.exit_code, 0);
  return {
    source: repository,
    version: "2.0.0",
    tag: "v2.0.0",
    object: object.stdout.toString().trim(),
  };
}

export async function updateSourceBuild(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const archive = await releaseArchive(directory, "success", join(directory, "unused-launcher"));
    const release = await updateSourceRepository(directory, archive, mode);
    const stage = join(directory, "stage");
    await mkdir(stage);
    if (mode === "changed-object") release.object = "0".repeat(40);
    if (mode === "success" || mode === "annotated") {
      const built = await buildUpdateRelease(release, stage, process.execPath);
      assert.deepEqual(await readFile(built), await readFile(archive));
    } else await assert.rejects(() => buildUpdateRelease(release, stage, process.execPath));
    return true;
  });
}

export async function updateInstallation(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const { installation, entry, launcher, previous, home, project } =
      await managedUpdate(directory);
    const archive = await releaseArchive(directory, mode, launcher);
    const retained =
      mode === "journal" || mode === "journal-failed" ? await createUpdateRun(home, project) : null;
    const journal = retained ? await readFile(join(retained.root, BoardFile.Journal)) : null;
    const output: unknown[] = [];
    const cli = createCli({
      ...defaultServices,
      executable: [process.execPath, entry],
      version: retained ? TitanRelease : "1.0.0",
      output: (value) => output.push(value),
      cwd: () => project,
    });
    const args = ["update", "--from", archive, "--home", home, "--project", project, "--json"];
    if (mode === "success" || mode === "earlier-backup" || mode === "journal") {
      if (mode === "earlier-backup") {
        await mkdir(join(home, "backups", "earlier"), { recursive: true });
        await writeFile(join(home, "backups", "earlier", "retained"), "earlier data");
      }
      assert.equal(await cli(args), 0);
      assert.notEqual(await readlink(launcher), previous);
      assert.equal((await realpath(launcher)).endsWith("node_modules/@titan/cli/titan.js"), true);
      assert.equal(output.length, 1);
    } else
      await assert.rejects(
        () => cli(args),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /backup is retained at/);
          return true;
        },
      );
    const transaction = UpdateTransactionSchema.parse(
      JSON.parse((await readFile(join(home, UpdateFile.Transaction))).toString()),
    );
    assert.ok(transaction.backup);
    if (mode === "changed-launcher") {
      assert.equal(await readlink(launcher), "external-launcher");
      assert.equal(transaction.phase, UpdatePhase.Verified);
    } else if (mode === "success" || mode === "earlier-backup" || mode === "journal")
      assert.equal(transaction.phase, UpdatePhase.Complete);
    else {
      assert.equal(await readlink(launcher), previous);
      assert.equal(transaction.phase, UpdatePhase.RolledBack);
    }
    assert.equal((await readFile(join(home, "credential"))).toString(), "private credential");
    assert.equal((await lstat(join(home, "credential"))).mode & 0o777, 0o600);
    assert.equal((await readFile(entry)).toString(), "original entry");
    if (retained && journal)
      assert.deepEqual(await readFile(join(retained.root, BoardFile.Journal)), journal);
    assert.equal(
      (await readFile(join(project, ".titan", "journal"))).toString(),
      "private proposal and journal",
    );
    assert.equal(
      (await readFile(join(transaction.backup, "home", "credential"))).toString(),
      "private credential",
    );
    assert.equal(
      (await readdir(join(installation, "releases"))).includes("titan-cli-original"),
      true,
    );
    return true;
  });
}

export async function automaticUpdate(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const { entry, launcher, previous, home, project } = await managedUpdate(directory);
    const archive = await releaseArchive(
      directory,
      mode === "failed" || mode === "wrong-release" ? mode : "success",
      launcher,
    );
    const source = await updateSourceRepository(directory, archive, "success");
    await writeFile(
      join(home, "config.yaml"),
      JSON.stringify({
        update: {
          source: source.source,
          mode: mode === "notify" || mode === "off" ? mode : "auto",
        },
      }),
    );
    const output: unknown[] = [];
    const notices: string[] = [];
    let handedOff = false;
    const cli = createCli({
      ...defaultServices,
      executable: [process.execPath, entry],
      version: "1.0.0",
      output: (value) => output.push(value),
      notice: (value) => notices.push(value),
      cwd: () => project,
      async handoff(selected, args, cwd) {
        assert.equal(selected, launcher);
        assert.equal(cwd, project);
        assert.deepEqual(args, ["config", "--home", home, "--project", project, "--json"]);
        handedOff = true;
        return 17;
      },
    });
    let entered = false;
    const factory =
      mode === "busy"
        ? () =>
            new FakeBackend(async (spec, _prompt, signal) => {
              entered = true;
              await new Promise<void>((done) =>
                signal.addEventListener(SignalEvent.Abort, () => done(), { once: true }),
              );
              return schemaFakeAnswer(spec);
            })
        : createFakeBackend;
    const server =
      mode === "idle" || mode === "idle-version" || mode === "busy"
        ? await startServer(home, factory)
        : undefined;
    const proxy = mode === "idle-version" ? await aliasDaemonVersion(home, "0.9.0") : null;
    try {
      if (mode === "busy") {
        await call(home, "/runs", "POST", {
          project,
          workflow: checkedWorkflow(),
          backend: Backend.Fake,
          client_id: "automatic-client",
          submission_id: "automatic-active",
        });
        assert.ok(await waitUntil(async () => entered));
      }
      const result = await cli(["config", "--home", home, "--project", project, "--json"]);
      const installs = mode === "success" || mode === "idle" || mode === "idle-version";
      assert.equal(result, installs ? 17 : 0);
      assert.equal(handedOff, installs);
      assert.equal(output.length, installs ? 0 : 1);
      assert.equal((await readlink(launcher)) !== previous, installs);
      if (mode === "off")
        assert.deepEqual((await readdir(home)).sort(), ["config.yaml", "credential"]);
      if (mode === "notify") assert.equal(notices.length, 1);
      if (mode === "failed") assert.equal(notices.length, 2);
      if (mode === "wrong-release") assert.equal(notices.length, 2);
      if (server && (mode === "idle" || mode === "idle-version")) await server.stopped;
      if (mode === "busy") {
        assert.ok(await call(home, "/health"));
        assert.equal((await readdir(home)).includes(UpdateFile.Transaction), false);
      }
    } finally {
      await server?.stop();
      await proxy?.stop(true);
    }
    return true;
  });
}

export async function updateInterruption(phase: UpdatePhase) {
  return withTemporaryDirectory(async (directory) => {
    const { entry, launcher, previous, home, project } = await managedUpdate(directory);
    const archive = await releaseArchive(directory, "success", launcher);
    const marker = join(directory, "interrupted-phase");
    const source = join(directory, "update-process.ts");
    const install = resolve(import.meta.dir, "../../apps/cli/src/update-install.ts");
    const bootstrap = resolve(import.meta.dir, "../../apps/cli/src/bootstrap.ts");
    const code = [
      `import { installUpdate } from ${JSON.stringify(install)};`,
      `import { defaultServices } from ${JSON.stringify(bootstrap)};`,
      'import { writeFile } from "node:fs/promises";',
      `const selected = ${JSON.stringify({ entry, archive, home, project, marker, phase })};`,
      'const services = { ...defaultServices, executable: [process.execPath, selected.entry], version: "1.0.0", cwd: () => selected.project };',
      'process.stdout.write("ready\\n");',
      "await installUpdate({options:{from:selected.archive},positionals:[],home:selected.home,project:selected.project,services,emit(){}}, async (phase) => {",
      "  if (phase !== selected.phase) return;",
      "  await writeFile(selected.marker, phase);",
      "  await Bun.stdin.text();",
      "});",
    ].join("\n");
    await writeFile(source, code);
    const child = Bun.spawn([process.execPath, source], {
      timeout: TestProcessLimit.DefaultMilliseconds,
      cwd: project,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    try {
      const reader = child.stdout.getReader();
      const ready = await reader.read();
      reader.releaseLock();
      assert.equal(Buffer.from(ready.value ?? []).toString(), "ready\n");
      assert.ok(await waitUntil(async () => Bun.file(marker).exists()));
      assert.equal((await readFile(marker)).toString(), phase);
      const backups = await readdir(join(home, "backups"));
      child.kill(ProcessSignal.Kill);
      await child.exited;
      await assert.rejects(() => startServer(home, createFakeBackend), /interrupted update/);
      const cli = createCli({
        ...defaultServices,
        executable: [process.execPath, entry],
        version: "1.0.0",
        output() {},
        cwd: () => project,
      });
      assert.equal(await cli(["update", "--home", home]), 0);
      assert.equal(await readlink(launcher), previous);
      assert.deepEqual(await readdir(join(home, "backups")), backups);
      const transaction = UpdateTransactionSchema.parse(
        JSON.parse((await readFile(join(home, UpdateFile.Transaction))).toString()),
      );
      assert.equal(transaction.phase, UpdatePhase.RolledBack);
      assert.equal((await readFile(join(home, "credential"))).toString(), "private credential");
      assert.equal(
        (await readFile(join(project, ".titan", "journal"))).toString(),
        "private proposal and journal",
      );
      const replacement = await startServer(home, createFakeBackend);
      await replacement.stop();
      return true;
    } finally {
      if (child.exitCode === null) child.kill(ProcessSignal.Kill);
      await child.exited;
    }
  });
}

export async function updateRecovery(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const { installation, entry, launcher, previous, home } = await managedUpdate(directory);
    const nextRelease = join(installation, "releases", "titan-cli-next");
    const nextEntry = join(nextRelease, Packaging.InstalledPath, Packaging.Bundle);
    await mkdir(dirname(nextEntry), { recursive: true });
    await writeFile(nextEntry, "next entry");
    const nextBinary = join(nextRelease, Packaging.CliPath);
    await mkdir(dirname(nextBinary));
    await symlink(nextEntry, nextBinary);
    const transaction: UpdateTransaction = {
      schema_version: 1,
      installation,
      previous,
      next: "releases/titan-cli-next/node_modules/.bin/titan",
      phase: UpdatePhase.Preparing,
      backup: null,
      backup_digest: null,
    };
    if (["backed-up", "installed", "verified", "switched", "damaged-backup"].includes(mode)) {
      transaction.backup = await createUpdateBackup(home, [], "1.0.0");
      transaction.backup_digest = hash(
        await readFile(join(transaction.backup, UpdateFile.Manifest)),
      );
      transaction.phase =
        mode === "backed-up"
          ? UpdatePhase.BackedUp
          : mode === "installed"
            ? UpdatePhase.Installed
            : mode === "switched"
              ? UpdatePhase.Switched
              : UpdatePhase.Verified;
      if (mode === "damaged-backup")
        await writeFile(join(transaction.backup, UpdateFile.Manifest), "{}");
    }
    if (mode === "switched") {
      await rm(launcher);
      await symlink(transaction.next, launcher);
    }
    if (mode === "wrong-installation")
      transaction.installation = join(directory, "other-installation");
    if (mode === "unsafe-target") transaction.previous = "external-launcher";
    await writeFile(join(home, UpdateFile.Transaction), JSON.stringify(transaction));
    await assert.rejects(() => startServer(home, createFakeBackend), /interrupted update/);
    const cli = createCli({
      ...defaultServices,
      executable: [process.execPath, entry],
      version: "1.0.0",
      output() {},
      cwd: () => directory,
    });
    if (["preparing", "backed-up", "installed", "verified", "switched"].includes(mode)) {
      assert.equal(await cli(["update", "--home", home]), 0);
      assert.equal(await readlink(launcher), previous);
      await assertUpdateSettled(home);
      const replacement = await startServer(home, createFakeBackend);
      await replacement.stop();
    } else {
      await assert.rejects(() => cli(["update", "--home", home]));
      await assert.rejects(() => assertUpdateSettled(home));
    }
    assert.equal((await readFile(entry)).toString(), "original entry");
    return true;
  });
}

export async function updateAdmission(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const managed = await managedUpdate(directory);
    const archive = join(directory, "release.tgz");
    await writeFile(archive, "invalid archive");
    const context = {
      options: {
        from:
          mode === "directory"
            ? directory
            : mode === "archive-failed" || mode === "before-backup"
              ? archive
              : undefined,
      },
      positionals: [],
      home: mode === "same-home" ? managed.installation : managed.home,
      project: managed.project,
      services: {
        ...defaultServices,
        executable:
          mode === "missing-executable"
            ? undefined
            : ([
                process.execPath,
                mode === "unmanaged" ? import.meta.path : managed.entry,
              ] as const),
        version: "1.0.0",
        cwd: () => managed.project,
      },
      emit() {},
    };
    if (mode === "current" || mode === "same-home") {
      assert.deepEqual(await installUpdate(context), { current_version: "1.0.0", updated: false });
    } else if (mode === "removed-transaction") {
      const transaction: UpdateTransaction = {
        schema_version: 1,
        installation: managed.installation,
        previous: managed.previous,
        next: "releases/titan-cli-next/node_modules/.bin/titan",
        phase: UpdatePhase.Preparing,
        backup: null,
        backup_digest: null,
      };
      await writeFile(join(managed.home, UpdateFile.Transaction), JSON.stringify(transaction));
      await using held = new AsyncDisposableStack();
      await ownOfflineHome(managed.home, held);
      const pending = installUpdate(context);
      const failure = assert.rejects(pending, /Select a local Titan release package/);
      assert.ok(
        await waitUntil(async () => {
          await using attempt = new AsyncDisposableStack();
          try {
            await ownMaintenance(managed.home, attempt);
            return false;
          } catch {
            return true;
          }
        }),
      );
      await rm(join(managed.home, UpdateFile.Transaction));
      await held.disposeAsync();
      await failure;
    } else if (mode === "before-backup") {
      const failure = new Error("preparation interrupted");
      await assert.rejects(
        () =>
          installUpdate(context, async () => {
            throw failure;
          }),
        (error: unknown) => error === failure,
      );
      const transaction = UpdateTransactionSchema.parse(
        JSON.parse((await readFile(join(managed.home, UpdateFile.Transaction))).toString()),
      );
      assert.equal(transaction.phase, UpdatePhase.RolledBack);
      assert.equal(transaction.backup, null);
    } else await assert.rejects(() => installUpdate(context));
    assert.equal(await readlink(managed.launcher), managed.previous);
    assert.equal(
      (await readFile(join(managed.home, "credential"))).toString(),
      "private credential",
    );
    return true;
  });
}
