import { strict as assert } from "node:assert";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  BoardFile,
  KnowledgeKind,
  KnowledgeMeaningLocal,
  KnowledgeScope,
  Packaging,
  RunEventKind,
  RunStatus,
  UpdateFile,
  UpdatePhase,
  VendorPackage,
} from "@titan/constants";
import { KnowledgeHub, projectHubHome } from "@titan/knowledge";
import { captureCommand, ownedCommandProcesses } from "@titan/process";
import { requestServerStop } from "@titan/server/maintenance";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CliOutputSchema,
  type CommandProcessPort,
  McpTextContentSchema,
  RunEventSchema,
  UpdateBackupSchema,
  UpdateTransactionSchema,
  UpdateVersionSchema,
} from "@titan/types";
import { createUpdateRun } from "./update-backup.ts";

async function prepareInstalledCache(installation: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  const original = process.env.BUN_INSTALL_CACHE_DIR ?? join(homedir(), ".bun/install/cache");
  for (const name of await readdir(original))
    if (name.endsWith(".npm")) await cp(join(original, name), join(destination, name));
  const dependencies = join(installation, "node_modules");
  const names: string[] = [];
  for (const name of await readdir(dependencies)) {
    if (name.startsWith("@")) {
      for (const child of await readdir(join(dependencies, name))) names.push(join(name, child));
    } else if (!name.startsWith(".")) names.push(name);
  }
  for (const name of names) {
    const file = join(dependencies, name, "package.json");
    if (!(await Bun.file(file).exists())) continue;
    const manifest = JSON.parse((await readFile(file)).toString());
    const cached = `${manifest.name}@${manifest.version}@@@1`;
    const source = join(original, cached);
    if (!(await Bun.file(join(source, "package.json")).exists())) continue;
    await mkdir(dirname(join(destination, cached)), { recursive: true });
    await cp(source, join(destination, cached), { recursive: true });
    const index = join(destination, manifest.name);
    await mkdir(index, { recursive: true });
    await symlink(`../${basename(cached)}`, join(index, `${manifest.version}@@@1`));
  }
}

export async function prepareUpdatePackages(root: string, destination: string): Promise<void> {
  const source = join(destination, "source");
  await cp(resolve(root, Packaging.Destination), source, { recursive: true });
  for (const [entry, naming] of [
    [Packaging.CliSource, Packaging.Bundle],
    [Packaging.AgentSource, Packaging.AgentBundle],
    [Packaging.NativeToolSource, Packaging.NativeToolBundle],
  ]) {
    assert.ok(entry && naming);
    const build = await Bun.build({
      entrypoints: [resolve(root, entry)],
      outdir: source,
      naming,
      target: Packaging.Target,
      external: [
        VendorPackage.CodexCli,
        VendorPackage.Claude,
        VendorPackage.Transformers,
        KnowledgeMeaningLocal.SqliteVec,
      ],
      plugins: [
        {
          name: "installed-update-version",
          setup(builder) {
            builder.onLoad({ filter: /packages\/constants\/src\/runtime\.ts$/ }, () => ({
              contents: `export const TitanRelease = ${JSON.stringify(Packaging.UpdateVersion)};`,
              loader: "ts",
            }));
          },
        },
      ],
    });
    if (!build.success) throw new AggregateError(build.logs);
  }
  const manifest = JSON.parse((await readFile(join(source, "package.json"))).toString());
  manifest.version = Packaging.UpdateVersion;
  await writeFile(join(source, "package.json"), JSON.stringify(manifest));
  const good = join(destination, "success");
  await mkdir(good);
  const packed = await captureCommand(
    [process.execPath, "pm", "pack", "--destination", good],
    source,
  );
  assert.equal(packed.exit_code, 0, packed.stderr.toString());
  const bundle = join(source, Packaging.Bundle);
  const original = (await readFile(bundle)).toString();
  const boundary = original.startsWith("#!") ? original.indexOf("\n") + 1 : 0;
  for (const [mode, guard] of [
    ["failed", 'if (process.argv.includes("--backup")) process.exit(2);\n'],
    [
      "malformed",
      'if (process.argv.includes("--backup")) { console.log("invalid"); process.exit(0); }\n',
    ],
  ]) {
    assert.ok(mode && guard);
    await writeFile(bundle, original.slice(0, boundary) + guard + original.slice(boundary));
    const failed = join(destination, mode);
    await mkdir(failed);
    const rejected = await captureCommand(
      [process.execPath, "pm", "pack", "--destination", failed],
      source,
    );
    assert.equal(rejected.exit_code, 0, rejected.stderr.toString());
  }
  const warm = join(destination, "warm");
  await mkdir(warm);
  await writeFile(join(warm, "package.json"), UpdateFile.PrivateManifest);
  await prepareInstalledCache(dirname(destination), join(destination, "cache"));
  const cached = await captureCommand(
    [process.execPath, "add", "--ignore-scripts", join(good, Packaging.UpdateArchive)],
    warm,
    { timeout_ms: UpdateFile.PackageMilliseconds },
    undefined,
    {
      ...ownedCommandProcesses,
      spawn(command, cwd) {
        return Bun.spawn([...command], {
          cwd,
          detached: true,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, BUN_INSTALL_CACHE_DIR: join(destination, "cache") },
        });
      },
    },
  );
  assert.equal(cached.exit_code, 0, cached.stderr.toString());
}

export async function installedUpdate(cli: string, fixtures: string, mode: string) {
  return withTemporaryDirectory(async (root) => {
    const packageRoot = dirname(await realpath(cli));
    const dependencies = resolve(packageRoot, "../..");
    const installation = join(root, "installation");
    const release = join(installation, "releases/titan-cli-original");
    const entry = join(release, Packaging.InstalledPath, Packaging.Bundle);
    await mkdir(dirname(dirname(entry)), { recursive: true });
    await cp(packageRoot, dirname(entry), { recursive: true });
    for (const name of await readdir(dependencies)) {
      if (name === ".bin" || name === "@titan") continue;
      await symlink(join(dependencies, name), join(release, "node_modules", name));
    }
    const binary = join(release, Packaging.CliPath);
    await mkdir(dirname(binary));
    await symlink(entry, binary);
    const launcher = join(installation, "titan");
    const previous = "releases/titan-cli-original/node_modules/.bin/titan";
    await symlink(previous, launcher);
    const home = join(root, "home");
    const project = join(root, "project");
    const stubs = join(root, "bin");
    await mkdir(home);
    await mkdir(join(project, ".titan"), { recursive: true });
    await mkdir(stubs);
    for (const name of Packaging.ProbeStubNames)
      await writeFile(join(stubs, name), Packaging.ProbeStubScript, {
        mode: Packaging.ProbeStubMode,
      });
    await writeFile(join(home, "credential"), "retained credential", { mode: 0o600 });
    await writeFile(join(project, ".titan/journal"), "retained private journal");
    if (mode === "earlier-backup") {
      await mkdir(join(home, "backups/earlier"), { recursive: true });
      await writeFile(join(home, "backups/earlier/data"), "earlier backup");
    }
    const original = await readFile(entry);
    const archive = join(
      fixtures,
      mode === "failed" || mode === "malformed" ? mode : "success",
      Packaging.UpdateArchive,
    );
    const processes: CommandProcessPort = {
      ...ownedCommandProcesses,
      spawn(command, cwd) {
        return Bun.spawn([...command], {
          cwd,
          detached: true,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            PATH: [stubs, process.env.PATH].filter(Boolean).join(delimiter),
            BUN_INSTALL_CACHE_DIR: join(fixtures, "cache"),
          },
        });
      },
    };
    const title = "Sample inventory";
    const body = "The sample inventory contains three blue folders.";
    const entries = new Map<KnowledgeScope, string>();
    for (const [scope, directory] of [
      [KnowledgeScope.Home, home],
      [KnowledgeScope.Project, projectHubHome(project)],
    ] as const) {
      const hub = await KnowledgeHub.open(directory);
      try {
        const { entry: added } = await hub.add({ kind: KnowledgeKind.Fact, title, body });
        entries.set(scope, added.id);
      } finally {
        await hub.close();
      }
    }
    const run = await createUpdateRun(home, project);
    const journal = await readFile(join(run.root, BoardFile.Journal));
    async function checkKnowledge(selectedHome: string, selectedProject: string) {
      for (const [scope, id] of entries) {
        const directory =
          scope === KnowledgeScope.Home ? selectedHome : projectHubHome(selectedProject);
        const hub = await KnowledgeHub.open(directory);
        try {
          const { entry: retained } = await hub.get(id);
          assert.equal(retained.id, id);
          assert.equal(retained.title, title);
          assert.equal(retained.body, body);
        } finally {
          await hub.close();
        }
      }
    }
    const result = await captureCommand(
      [
        process.execPath,
        launcher,
        "update",
        "--from",
        archive,
        "--home",
        home,
        "--project",
        project,
        "--json",
      ],
      project,
      {
        timeout_ms: UpdateFile.PackageMilliseconds,
      },
      undefined,
      processes,
    );
    const succeeds = mode === "success" || mode === "earlier-backup";
    const transaction = UpdateTransactionSchema.parse(
      JSON.parse((await readFile(join(home, UpdateFile.Transaction))).toString()),
    );
    let diagnostic = "";
    if (succeeds && result.exit_code !== 0 && transaction.backup) {
      const inspected = await captureCommand(
        [
          process.execPath,
          join(installation, transaction.next),
          "doctor",
          "--backup",
          transaction.backup,
          "--home",
          join(transaction.backup, "home"),
          "--json",
        ],
        project,
        { timeout_ms: UpdateFile.PackageMilliseconds },
        undefined,
        processes,
      );
      diagnostic = JSON.stringify({
        transaction,
        exit_code: inspected.exit_code,
        stdout: inspected.stdout.toString(),
        stderr: inspected.stderr.toString(),
      });
    }
    assert.equal(
      result.exit_code === 0,
      succeeds,
      mode + result.stdout.toString() + result.stderr.toString() + diagnostic,
    );
    assert.equal(transaction.phase, succeeds ? UpdatePhase.Complete : UpdatePhase.RolledBack);
    assert.equal((await readlink(launcher)) !== previous, succeeds);
    const version = await captureCommand(
      [process.execPath, launcher, "--version", "--json"],
      project,
    );
    assert.equal(version.exit_code, 0, version.stderr.toString());
    if (succeeds)
      assert.equal(
        UpdateVersionSchema.parse(CliOutputSchema.parse(JSON.parse(version.stdout.toString())).data)
          .version,
        Packaging.UpdateVersion,
      );
    assert.deepEqual(await readFile(entry), original);
    assert.deepEqual(await readFile(join(run.root, BoardFile.Journal)), journal);
    assert.equal((await readFile(join(home, "credential"))).toString(), "retained credential");
    assert.equal(
      (await readFile(join(project, ".titan/journal"))).toString(),
      "retained private journal",
    );
    assert.ok(transaction.backup);
    if (!succeeds) {
      const failure = CliOutputSchema.parse(JSON.parse(result.stdout.toString()));
      assert.ok(failure.error);
      assert.ok(failure.error.message.includes(transaction.backup), failure.error.message);
    }
    for (const _ of [0, 1]) {
      const inspected = await captureCommand(
        [
          process.execPath,
          launcher,
          "doctor",
          "--backup",
          transaction.backup,
          "--home",
          join(transaction.backup, "home"),
          "--json",
        ],
        project,
      );
      assert.equal(
        inspected.exit_code,
        0,
        inspected.stdout.toString() + inspected.stderr.toString(),
      );
    }
    assert.equal(
      (await readFile(join(transaction.backup, "home/credential"))).toString(),
      "retained credential",
    );
    await checkKnowledge(home, project);
    const inventory = UpdateBackupSchema.parse(
      JSON.parse((await readFile(join(transaction.backup, UpdateFile.Manifest))).toString()),
    );
    const projectCopy = inventory.roots.find(({ source }) => source === projectHubHome(project));
    assert.ok(projectCopy);
    const restoredHome = join(root, "restore-home");
    const restoredProject = join(root, "restore-project");
    await cp(join(transaction.backup, UpdateFile.Home), restoredHome, { recursive: true });
    await cp(join(transaction.backup, projectCopy.copy), projectHubHome(restoredProject), {
      recursive: true,
    });
    await checkKnowledge(restoredHome, restoredProject);
    if (succeeds) {
      try {
        let recovered = journal;
        for (const iteration of [0, 1]) {
          const retained = await captureCommand(
            [process.execPath, launcher, "status", run.run_id, "--home", home, "--json"],
            project,
          );
          assert.equal(
            retained.exit_code,
            0,
            retained.stdout.toString() + retained.stderr.toString(),
          );
          assert.equal(
            CliOutputSchema.parse(JSON.parse(retained.stdout.toString())).identifiers.run_id,
            run.run_id,
          );
          const transport = new StdioClientTransport({
            command: process.execPath,
            args: [launcher, "mcp", "--home", home],
            stderr: "pipe",
          });
          const client = new Client({ name: "installed-update-recovery", version: "1" });
          try {
            await client.connect(transport);
            const inspected = await client.callTool({
              name: "titan_status",
              arguments: { run_id: run.run_id },
            });
            assert.notEqual(inspected.isError, true, JSON.stringify(inspected));
            const content = McpTextContentSchema.parse(inspected.content);
            assert.equal(JSON.parse(content[0]?.text ?? "").run_id, run.run_id);
            const current = await client.callTool({ name: "titan_runs", arguments: {} });
            assert.notEqual(current.isError, true, JSON.stringify(current));
          } finally {
            await client.close();
            await transport.close();
          }
          const current = await captureCommand(
            [process.execPath, launcher, "runs", "--home", home, "--json"],
            project,
          );
          assert.equal(current.exit_code, 0, current.stdout.toString() + current.stderr.toString());
          assert.equal(await readlink(launcher), transaction.next);
          const observed = await readFile(join(run.root, BoardFile.Journal));
          if (iteration === 0) {
            assert.deepEqual(observed.subarray(0, journal.length), journal);
            const appended = observed.subarray(journal.length).toString().trim().split("\n");
            assert.equal(appended.length, 1);
            const event = RunEventSchema.parse(JSON.parse(appended[0] ?? ""));
            assert.equal(event.type, RunEventKind.Restart);
            assert.equal(event.state.state, RunStatus.Blocked);
            assert.equal(event.state.runtime_version, run.runtime_version);
            recovered = observed;
          } else assert.deepEqual(observed, recovered);
        }
      } finally {
        await requestServerStop(home);
      }
    }
    if (mode === "earlier-backup")
      assert.equal(
        (await readFile(join(transaction.backup, "home/backups/earlier/data"))).toString(),
        "earlier backup",
      );
    return true;
  });
}
