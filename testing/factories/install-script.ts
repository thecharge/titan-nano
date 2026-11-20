import { strict as assert } from "node:assert";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readlink,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  BoardFile,
  ConfigFile,
  ErrorCode,
  ErrorField,
  KnowledgeKind,
  KnowledgeMeaningLocal,
  MissingProcessCode,
  Packaging,
  ProcessSignal,
  RunEventKind,
  RunStatus,
  ServerFile,
  ServerRoute,
  SignalEvent,
  TitanRelease,
  UpdateFile,
  VendorPackage,
} from "@titan/constants";
import { KnowledgeHub, ownKnowledge } from "@titan/knowledge";
import { call, readAddress, startServer } from "@titan/server";
import { ownMaintenance, ownOfflineHome, requestServerStop } from "@titan/server/maintenance";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CliOutputSchema,
  InstallCommandLinkSchema,
  RunEventSchema,
  ServerHealthSchema,
  ServerOwnerSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { schemaFakeAnswer } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";
import { createUpdateRun } from "./update-backup.ts";

const Shell = resolve(import.meta.dir, "../fixtures/run-shell.sh");
const Script = resolve(import.meta.dir, "../../install.sh");
const BunLink = "bun";
const RefusedCode = 2;

function stopBuild(pid: number): void {
  try {
    process.kill(pid, ProcessSignal.Kill);
  } catch (error) {
    if (!(error instanceof Error && Reflect.get(error, ErrorField.Code) === MissingProcessCode))
      throw error;
  }
}

export async function startScript(script: string | null, withBun: boolean) {
  return withTemporaryDirectory(async (empty) => {
    if (withBun) await symlink(process.execPath, resolve(empty, BunLink));
    const child = Bun.spawn([Shell, script ?? Script], {
      env: { PATH: empty, HOME: empty },
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(child.stdout).text();
    assert.equal(await child.exited, RefusedCode);
    return {
      namesBun: out.includes("bun"),
      namesGit: out.includes("git"),
      offersFlag: out.includes("--install-bun"),
    };
  });
}

export async function installBootstrap(scenario: string) {
  return withTemporaryDirectory(async (root) => {
    await using ownership = new AsyncDisposableStack();
    const source = resolve(root, "source tree");
    const bin = resolve(root, "bin");
    const target = resolve(root, scenario === "default" ? "titan" : "installed tool");
    const record = resolve(root, "doctor.txt");
    const project = resolve(source, "selected project");
    const command = resolve(root, ".local/bin/titan");
    await mkdir(source);
    await mkdir(project);
    await mkdir(resolve(source, "dist"));
    await writeFile(resolve(source, "dist/titan-cli-old.tgz"), "retained archive");
    await mkdir(bin);
    await mkdir(target);
    await copyFile(Script, resolve(source, "install.sh"));
    await symlink(resolve(import.meta.dir, "../../tooling"), resolve(source, "tooling"));
    await copyFile(resolve(import.meta.dir, "../fixtures/install-bun.sh"), resolve(bin, "bun"));
    await chmod(resolve(bin, "bun"), 0o755);
    await symlink("/bin/true", resolve(bin, "git"));
    const manifest =
      scenario === "fresh" ? '{"private":true}\n' : '{"private":true,"name":"keep-me"}';
    if (scenario !== "fresh") await writeFile(resolve(target, "package.json"), manifest);
    if (scenario === "collision") await writeFile(resolve(target, "titan"), "user file");
    if (scenario === "command-file" || scenario === "command-link") {
      await mkdir(resolve(root, ".local/bin"), { recursive: true });
      if (scenario === "command-file") await writeFile(command, "user command");
      else await symlink(resolve(root, "another-command"), command);
    }
    if (scenario === "held-install") await ownMaintenance(target, ownership);
    if (scenario === "stale-install") await mkdir(resolve(target, ".install-lock"));
    if (scenario === "linked-releases") await symlink(source, resolve(target, "releases"));
    if (scenario === "legacy" || scenario === "killed-reinstall") {
      await mkdir(resolve(target, "node_modules/.bin"), { recursive: true });
      await copyFile(
        resolve(import.meta.dir, "../fixtures/install-doctor.sh"),
        resolve(target, "node_modules/.bin/titan"),
      );
      await symlink("node_modules/.bin/titan", resolve(target, "titan"));
    }
    const args = scenario === "default" ? [] : [target];
    if (scenario === "unknown-option") args.push("--unknown");
    if (scenario === "multiple-targets") args.push(resolve(root, "another"));
    if (scenario.startsWith("setup-") && scenario !== "setup-invalid")
      args.push(
        "--harness",
        scenario === "setup-both" ? "both" : scenario === "setup-claude" ? "claude" : "codex",
      );
    if (scenario === "setup-both" || scenario === "setup-failure")
      args.push("--project", "selected project");
    if (scenario === "setup-invalid") args.push("--harness", "unknown");
    if (scenario === "missing-harness") args.push("--harness");
    if (scenario === "project-without-harness") args.push("--project", project);
    if (scenario === "missing-project") args.push("--harness", "codex", "--project", "absent");
    if (scenario === "repeated-harness") args.push("--harness", "codex", "--harness", "claude");
    if (scenario === "relative-target") args[0] = "../installed tool";
    const options = {
      cwd: source,
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        HOME: root,
        TITAN_TEST_BUN_VERSION: scenario === "invalid-version" ? "invalid" : "1.3.10",
        TITAN_TEST_INSTALL_CASE: scenario,
        TITAN_TEST_INSTALL_DOCTOR: resolve(import.meta.dir, "../fixtures/install-doctor.sh"),
        TITAN_TEST_INSTALL_RECORD: record,
        TITAN_TEST_INSTALL_RUNTIME: process.execPath,
      },
      stdout: "ignore" as const,
      stderr: "ignore" as const,
    };
    const child = Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options);
    if (scenario === "concurrent") {
      const second = resolve(root, "second installation");
      const concurrent = Bun.spawn([Shell, resolve(source, "install.sh"), second], {
        ...options,
        env: { ...options.env, TITAN_TEST_INSTALL_RECORD: `${record}.second` },
      });
      assert.equal(await concurrent.exited, 0);
      assert.ok(await readFile(resolve(second, await readlink(resolve(second, "titan")))));
      assert.equal(await readFile(`${record}.second`, "utf8"), `${second}\ndoctor\n`);
    }
    if (scenario === "killed-install" || scenario === "killed-reinstall") {
      let build: number | undefined;
      try {
        assert.ok(await waitUntil(() => exists(record)));
        build = Number(await readFile(record, "utf8"));
        const previous = await readlink(resolve(target, "titan")).catch(() => null);
        const blocked = Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options);
        assert.equal(await blocked.exited, 2);
        child.kill(ProcessSignal.Kill);
        await child.exited;
        assert.equal(await readlink(resolve(target, "titan")).catch(() => null), previous);
        options.env.TITAN_TEST_INSTALL_CASE = "fresh";
      } finally {
        if (child.exitCode === null) child.kill(ProcessSignal.Kill);
        await child.exited;
        if (build) stopBuild(build);
      }
    }
    let code = scenario.startsWith("killed-")
      ? await Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options).exited
      : await child.exited;
    assert.equal(
      await readFile(resolve(source, "dist/titan-cli-old.tgz"), "utf8"),
      "retained archive",
    );
    if (scenario === "repeat" && code === 0) {
      const before = await readlink(resolve(target, "titan"));
      code = await Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options).exited;
      assert.notEqual(await readlink(resolve(target, "titan")), before);
      assert.ok(await readFile(resolve(target, before)));
    }
    if (scenario === "repeat-failure" && code === 0) {
      const before = await readlink(resolve(target, "titan"));
      options.env.TITAN_TEST_INSTALL_CASE = "doctor-failure";
      code = await Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options).exited;
      assert.equal(await readlink(resolve(target, "titan")), before);
      assert.ok(await readFile(resolve(target, before)));
    }
    assert.equal(await readFile(resolve(target, "package.json"), "utf8"), manifest);
    if (scenario.startsWith("setup-") && scenario !== "setup-invalid") {
      const selected = scenario === "setup-both" || scenario === "setup-failure" ? project : source;
      const agents =
        scenario === "setup-both"
          ? ["codex", "claude"]
          : [scenario === "setup-claude" ? "claude" : "codex"];
      assert.equal(
        await readFile(`${record}.setup`, "utf8"),
        agents
          .map((agent) => `${source}\ninstall\n--harness\n${agent}\n--project\n${selected}\n`)
          .join(""),
      );
      assert.ok(await readFile(resolve(target, await readlink(resolve(target, "titan")))));
    }
    if (scenario === "collision")
      assert.equal(await readFile(resolve(target, "titan"), "utf8"), "user file");
    if (code !== 0 && scenario !== "repeat-failure") {
      if (scenario === "doctor-failure" || scenario === "add-failure")
        await assert.rejects(readlink(resolve(target, "titan")), { code: "ENOENT" });
      return { code, preserved: true };
    }
    assert.match(
      await readlink(resolve(target, "titan")),
      /^releases\/titan-cli-test\.[^/]+\/node_modules\/\.bin\/titan$/,
    );
    assert.equal(await readFile(record, "utf8"), `${target}\ndoctor\n`);
    const guide = Bun.spawn(
      [
        Shell,
        scenario === "fresh" || scenario === "default" ? command : resolve(target, "titan"),
        "guide",
      ],
      {
        cwd: source,
        env: { TITAN_TEST_INSTALL_RECORD: record },
        stdout: "ignore",
        stderr: "ignore",
      },
    );
    assert.equal(await guide.exited, 0);
    assert.equal(await readFile(record, "utf8"), `${source}\nguide\n`);
    if (scenario === "command-file") assert.equal(await readFile(command, "utf8"), "user command");
    else if (scenario === "command-link")
      assert.equal(await readlink(command), resolve(root, "another-command"));
    else if (scenario !== "concurrent")
      assert.equal(await readlink(command), resolve(target, "titan"));
    return { code, preserved: true };
  });
}

async function lifecycleArchive(root: string, version: string): Promise<string> {
  const workspace = resolve(import.meta.dir, "../..");
  const source = resolve(root, version);
  await mkdir(source);
  const result = await Bun.build({
    entrypoints: [resolve(workspace, Packaging.CliSource)],
    root: workspace,
    outdir: source,
    naming: Packaging.Bundle,
    target: Packaging.Target,
    external: [
      VendorPackage.CodexCli,
      VendorPackage.Claude,
      VendorPackage.Transformers,
      KnowledgeMeaningLocal.SqliteVec,
    ],
    plugins: [
      {
        name: "lifecycle-version",
        setup(builder) {
          builder.onLoad({ filter: /packages\/constants\/src\/runtime\.ts$/ }, () => ({
            contents: `export const TitanRelease = ${JSON.stringify(version)};`,
            loader: "ts",
          }));
          builder.onLoad({ filter: /\.ts$/ }, async ({ path }) => ({
            contents: await readFile(path),
            loader: "ts",
          }));
          builder.onLoad({ filter: /\.[cm]?js$/ }, async ({ path }) => ({
            contents: await readFile(path),
            loader: "js",
          }));
        },
      },
    ],
  });
  if (!result.success) throw new AggregateError(result.logs);
  const entry = resolve(source, Packaging.Bundle);
  await chmod(entry, 0o755);
  await writeFile(
    resolve(source, "package.json"),
    JSON.stringify({
      name: Packaging.CliPackage,
      version,
      bin: { titan: Packaging.Bundle },
    }),
  );
  const pack = Bun.spawn([process.execPath, "pm", "pack", "--destination", root], {
    cwd: source,
    stdout: "ignore",
    stderr: "pipe",
  });
  assert.equal(await pack.exited, 0, await new Response(pack.stderr).text());
  return resolve(root, `${Packaging.ArchivePrefix}${version}${Packaging.ArchiveExtension}`);
}

async function idleUninstall(
  launcher: string,
  home: string,
  cwd: string,
  refuse: () => Promise<void>,
) {
  const daemon = Bun.spawn([process.execPath, launcher, "serve", "--home", home, "--json"], {
    cwd,
    env: { HOME: cwd },
    stdout: "ignore",
    stderr: "inherit",
  });
  const ownerFile = resolve(home, ServerFile.Lock, ServerFile.Owner);
  const health = async () => ServerHealthSchema.parse(await call(home, ServerRoute.Health, "GET"));
  try {
    assert.ok(await waitUntil(async () => (await health().catch(() => null))?.ready === true));
    const owner = ServerOwnerSchema.parse(JSON.parse(await readFile(ownerFile, "utf8")));
    assert.equal(owner.pid, daemon.pid);
    const { url } = await readAddress(home);
    const version = (await health()).version;
    await refuse();
    assert.equal(daemon.exitCode, null);
    assert.deepEqual(JSON.parse(await readFile(ownerFile, "utf8")), owner);
    assert.equal((await readAddress(home)).url, url);
    assert.equal((await health()).version, version);
  } finally {
    if (daemon.exitCode === null) daemon.kill();
    await daemon.exited;
  }
}

async function recoverReinstalledRun(
  command: string,
  home: string,
  cwd: string,
  retained: Awaited<ReturnType<typeof createUpdateRun>>,
  journal: Buffer,
  run: (args: string[], expected: number, cwd?: string) => Promise<string>,
) {
  try {
    const status = CliOutputSchema.parse(
      JSON.parse(
        await run(
          [process.execPath, command, "status", retained.run_id, "--home", home, "--json"],
          0,
          cwd,
        ),
      ),
    );
    assert.equal(status.identifiers.run_id, retained.run_id);
    const recovered = await readFile(resolve(retained.root, BoardFile.Journal));
    assert.deepEqual(recovered.subarray(0, journal.length), journal);
    const events = recovered.subarray(journal.length).toString().trim().split("\n");
    assert.equal(events.length, 1);
    const event = RunEventSchema.parse(JSON.parse(events[0] ?? ""));
    assert.equal(event.type, RunEventKind.Restart);
    assert.equal(event.state.state, RunStatus.Blocked);
    assert.equal(event.state.runtime_version, retained.runtime_version);
  } finally {
    if (await exists(resolve(home, ServerFile.Lock))) await requestServerStop(home);
  }
}

async function activeUninstall(home: string, project: string, invoke: () => Promise<unknown>) {
  let entered = false;
  const server = await startServer(
    home,
    () =>
      new FakeBackend(async (spec, _prompt, signal) => {
        entered = true;
        await new Promise<void>((done) =>
          signal.addEventListener(SignalEvent.Abort, () => done(), { once: true }),
        );
        return schemaFakeAnswer(spec);
      }),
  );
  try {
    await call(home, "/runs", "POST", {
      project,
      workflow: checkedWorkflow(),
      backend: Backend.Fake,
      client_id: "uninstall",
      submission_id: "active",
    });
    assert.ok(await waitUntil(async () => entered));
    await invoke();
  } finally {
    await server.stop();
  }
}

export async function managedLifecycle(scenario: string) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, "source");
    const project = resolve(root, "other project");
    const installation = resolve(root, "managed install");
    const launcher = resolve(installation, "titan");
    const command = resolve(root, ".local/bin/titan");
    const ownership = resolve(installation, UpdateFile.CommandOwnership);
    const home = resolve(root, "home");
    const toolBin = resolve(root, "tools");
    for (const folder of [source, project, home, installation, toolBin, dirname(command)])
      await mkdir(folder, { recursive: true });
    await symlink(resolve(import.meta.dir, "../../node_modules"), resolve(root, "node_modules"));
    await symlink(process.execPath, resolve(toolBin, "bun"));
    if (scenario === "pre-existing") await symlink(launcher, command);
    const original = await lifecycleArchive(root, TitanRelease);
    await copyFile(Script, resolve(source, "install.sh"));
    await symlink(resolve(import.meta.dir, "../../tooling"), resolve(source, "tooling"));
    await writeFile(
      resolve(source, "package.json"),
      JSON.stringify({ private: true, scripts: { "pack:preview": "bun pack.ts" } }),
    );
    const pack = (archive: string) =>
      writeFile(
        resolve(source, "pack.ts"),
        `import {copyFile} from "node:fs/promises"; await copyFile(${JSON.stringify(archive)}, process.argv[2] + "/titan-cli-local.tgz");`,
      );
    await pack(original);
    const paths = [resolve(installation, "custom"), resolve(home, ConfigFile.User)];
    for (const path of paths) await writeFile(path, "{}");
    async function run(args: string[], expected: number, cwd = project) {
      const process = Bun.spawn(args, {
        cwd,
        env: { HOME: root, PATH: `${toolBin}:/usr/bin:/bin` },
        stdout: "pipe",
        stderr: "pipe",
      });
      const out = await new Response(process.stdout).text();
      const errors = await new Response(process.stderr).text();
      assert.equal(await process.exited, expected, out + errors);
      return out;
    }
    const install = [Shell, resolve(source, "install.sh"), installation];
    const uninstall = [process.execPath, launcher, "uninstall", "--home", home, "--json"];
    await run(install, 0);
    const previous = await readlink(launcher);
    const args = uninstall.slice(2);
    const direct = createCli({
      ...defaultServices,
      executable: [process.execPath, launcher],
      cwd: () => project,
      output: () => {},
    });
    if (scenario === "pre-existing") await assert.rejects(lstat(ownership), { code: "ENOENT" });
    else
      assert.equal(
        InstallCommandLinkSchema.parse(JSON.parse(await readFile(ownership, "utf8"))).path,
        command,
      );
    if (scenario === "replaced") {
      await unlink(command);
      await symlink(launcher, command);
    }
    if (
      [
        "active",
        "idle",
        "replaced",
        "locked",
        "external-locked",
        "external-maintenance",
        "knowledge-locked",
      ].includes(scenario)
    ) {
      await using lease = new AsyncDisposableStack();
      if (scenario === "locked") await ownMaintenance(installation, lease);
      if (scenario === "external-locked") await ownOfflineHome(home, lease);
      if (scenario === "external-maintenance") await ownMaintenance(home, lease);
      if (scenario === "knowledge-locked") await ownKnowledge(home, lease);
      const refuse = async () => {
        const result = CliOutputSchema.parse(JSON.parse(await run(uninstall, 2)));
        const code = ["active", "idle", "external-locked", "knowledge-locked"].includes(scenario)
          ? ErrorCode.ServerBusy
          : scenario === "replaced"
            ? ErrorCode.ConfigConflict
            : ErrorCode.ServerLocked;
        assert.equal(result.error?.code, code);
        await assert.rejects(() => direct(args), { code });
        assert.equal(await readlink(launcher), previous);
        assert.equal(await readlink(command), launcher);
      };
      if (scenario === "active") await activeUninstall(home, project, refuse);
      else if (scenario === "idle") {
        const other = resolve(root, "other install");
        await run([Shell, resolve(source, "install.sh"), other], 0);
        await idleUninstall(resolve(other, "titan"), home, project, refuse);
      } else await refuse();
      return true;
    }
    const unmanaged = await run(
      [process.execPath, resolve(root, TitanRelease, Packaging.Bundle), "uninstall", "--json"],
      2,
    );
    assert.match(unmanaged, /bun remove @titan\/cli/);
    const unmanagedCli = createCli({ ...defaultServices, executable: undefined });
    await assert.rejects(() => unmanagedCli(args), { code: ErrorCode.Arguments });
    await assert.rejects(
      () => direct(["uninstall", "--home", resolve(paths[1] ?? home, "child")]),
      {
        code: "ENOTDIR",
      },
    );
    const retained = await createUpdateRun(home, project);
    const journalPath = resolve(retained.root, BoardFile.Journal);
    const journal = await readFile(journalPath);
    const hub = await KnowledgeHub.open(home);
    const { entry } = await hub
      .add({ kind: KnowledgeKind.Fact, title: "Retained fact", body: "Keep this fact." })
      .finally(() => hub.close());
    if (scenario === "owned") {
      const update = await lifecycleArchive(root, Packaging.UpdateVersion);
      await run(
        [process.execPath, launcher, "update", "--home", home, "--from", update, "--json"],
        0,
      );
      assert.notEqual(await readlink(launcher), previous);
      assert.match(
        await run([process.execPath, command, "--version", "--json"], 0),
        /0\.1\.0-alpha\.2/,
      );
      await pack(update);
    }
    const selected = await readlink(launcher);
    const leasePaths = [ServerFile.Lease, ServerFile.MaintenanceLease].map((name) =>
      resolve(home, name),
    );
    if (scenario === "pre-existing")
      for (const path of leasePaths) await assert.rejects(lstat(path), { code: "ENOENT" });
    await run(uninstall, 0);
    if (scenario === "pre-existing")
      for (const path of leasePaths) await assert.rejects(lstat(path), { code: "ENOENT" });
    await assert.rejects(lstat(launcher), { code: "ENOENT" });
    if (scenario === "pre-existing") assert.equal(await readlink(command), launcher);
    else await assert.rejects(lstat(command), { code: "ENOENT" });
    for (const release of [previous, selected])
      assert.ok(await exists(resolve(installation, release)));
    await run(install, 0);
    assert.equal(await readlink(command), launcher);
    const reinstalled = await run([process.execPath, command, "--version", "--json"], 0, source);
    if (scenario === "owned") assert.match(reinstalled, /0\.1\.0-alpha\.2/);
    for (const path of paths) assert.equal(await readFile(path, "utf8"), "{}");
    assert.deepEqual(await readFile(journalPath), journal);
    await recoverReinstalledRun(command, home, source, retained, journal, run);
    const reopened = await KnowledgeHub.open(home);
    assert.equal(
      (await reopened.get(entry.id).finally(() => reopened.close())).entry.body,
      "Keep this fact.",
    );
    assert.equal(await direct(args), 0);
    await assert.rejects(lstat(launcher), { code: "ENOENT" });
    return true;
  });
}
