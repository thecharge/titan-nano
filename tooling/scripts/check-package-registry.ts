import { strict as assert } from "node:assert";
import { copyFile, cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import {
  Backend,
  CliCommand,
  CliRuntime,
  FileEncoding,
  PackageRegistryGate as Gate,
  HookConfigArgument,
  HookFile,
  HookLimit,
  HookSecretCommand,
  KnowledgeMeaningLocal,
  OfflineRunArguments,
  OfflineTest,
  PackageManagerArgument,
  Packaging,
  PathPart,
  PodmanArgument,
  PrerequisiteName,
  ProbeOption,
  ProcessIo,
  RunStatus,
  ScriptSandbox,
  TextSymbol,
  VendorPackage,
} from "@titan/constants";
import { captureCommand } from "@titan/process";
import { CliOutputSchema, DoctorResultSchema, ObjectSchema } from "@titan/types";
import { packageOutput } from "./package-output.ts";
import { verifySandboxFiles } from "./sandbox-distribution.ts";
import { imageName, root } from "./test-image.ts";

const inventoryLimits = {
  maximum_bytes: Packaging.OutputBytes,
  timeout_ms: Packaging.OutputMilliseconds,
};
const publicFiles: readonly string[] = [
  HookFile.Manifest,
  Packaging.Bundle,
  Packaging.AgentBundle,
  Packaging.NativeToolBundle,
  Packaging.Readme,
  ...Packaging.LegalFiles,
  ScriptSandbox.Binary,
  ScriptSandbox.Source.LicenseOutput,
  ScriptSandbox.Source.Archive,
  ScriptSandbox.Source.NoticesOutput,
  ScriptSandbox.Source.InventoryOutput,
];
const publicDirectories = [Packaging.Examples, Packaging.Answers, Packaging.Assets];

function releaseArchivePaths(names: readonly string[], types: readonly string[]): string[] {
  assert.equal(names.length, types.length, Gate.InvalidArchive);
  assert.equal(new Set(names).size, names.length, Gate.InvalidArchive);
  const files: string[] = [];
  for (const [index, name] of names.entries()) {
    assert(name.startsWith(Gate.PackagePrefix) && Gate.SafePath.test(name), Gate.InvalidArchive);
    const path = name.slice(Gate.PackagePrefix.length).replace(/\/$/, TextSymbol.Empty);
    const kind = types[index]?.[0];
    assert(kind === Gate.Regular || kind === Gate.Directory, Gate.InvalidArchive);
    if (!path && kind === Gate.Directory) continue;
    assert(
      !path
        .split(PathPart.Separator)
        .some((part) => !part || part === PathPart.Parent || part === PathPart.Current),
      Gate.InvalidArchive,
    );
    assert(!Gate.PrivatePath.test(path), Gate.InvalidArchive);
    const directory = publicDirectories.some(
      (base) => path === base || path.startsWith(`${base}${PathPart.Separator}`),
    );
    assert(directory || (kind === Gate.Regular && publicFiles.includes(path)), Gate.InvalidArchive);
    if (kind === Gate.Regular) files.push(name);
  }
  assert(files.includes(Gate.PackagePrefix + HookFile.Manifest), Gate.InvalidArchive);
  return files;
}

export async function verifyReleaseArchive(archive: string): Promise<void> {
  const names = (await tarOutput(Gate.List, archive)).trimEnd().split(TextSymbol.Newline);
  verifySandboxFiles(names);
  const types = await tarOutput(Gate.ListTypes, archive);
  const files = releaseArchivePaths(names, types.trimEnd().split(TextSymbol.Newline));
  const stage = await mkdtemp(resolve(tmpdir(), Packaging.TemporaryPrefix));
  try {
    await packageOutput(
      [Gate.Tar, Gate.Extract, archive, Gate.ChangeDirectory, stage],
      root,
      inventoryLimits,
    );
    for (let offset = 0; offset < files.length; offset += HookLimit.FilesPerScan) {
      const scan = await captureCommand(
        [
          ...HookSecretCommand,
          HookConfigArgument.Secrets,
          resolve(root, HookFile.Secrets),
          ...files
            .slice(offset, offset + HookLimit.FilesPerScan)
            .map((path) => resolve(stage, path)),
        ],
        root,
        inventoryLimits,
      );
      assert.equal(scan.exit_code, 0, Gate.Secret);
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

async function tarOutput(flag: string, archive: string, ...entries: string[]): Promise<string> {
  return (
    await packageOutput([Gate.Tar, flag, archive, ...entries], tmpdir(), inventoryLimits)
  ).toString();
}

async function archiveManifest(archive: string) {
  const manifest = ObjectSchema.parse(
    JSON.parse(await tarOutput(Gate.ReadEntry, archive, Gate.PackagePrefix + HookFile.Manifest)),
  );
  const name = String(manifest.name);
  const version = String(manifest.version);
  assert(name === manifest.name && Gate.PackageName.test(name), Gate.InvalidArchive);
  assert(
    version === manifest.version && Packaging.PinnedVersionPattern.test(version),
    Gate.InvalidArchive,
  );
  return { name, version, manifest };
}

async function dependencyArchives(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const archives = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(Packaging.ArchiveExtension),
  );
  assert(archives.length <= Gate.MaximumArchives, Gate.InvalidArchive);
  return archives.map((entry) => resolve(directory, entry.name)).sort();
}

async function registryInventory(archives: readonly string[]) {
  const inventory = [];
  for (const archive of archives) {
    const details = await archiveManifest(archive);
    const hash = new Bun.CryptoHasher(Gate.Hash);
    const integrity = new Bun.CryptoHasher(Gate.Integrity);
    for await (const bytes of Bun.file(archive).stream()) {
      hash.update(bytes);
      integrity.update(bytes);
    }
    inventory.push({
      ...details,
      archive,
      sha256: hash.digest(FileEncoding.Hex),
      integrity: `${Gate.Integrity}${Gate.Regular}${integrity.digest(FileEncoding.Base64)}`,
    });
  }
  return inventory;
}

async function installCase(
  directory: string,
  registry: string,
  specifier: string,
  missing: boolean,
) {
  const installation = await mkdtemp(resolve(directory, Gate.InstallPrefix));
  const home = resolve(installation, Gate.Home);
  await mkdir(home);
  await writeFile(resolve(installation, HookFile.Manifest), JSON.stringify({ private: true }));
  const env = {
    HOME: home,
    PATH: `${dirname(process.execPath)}${TextSymbol.Colon}${Gate.SystemPath}`,
    XDG_CONFIG_HOME: home,
  };
  const child = Bun.spawn(
    [
      process.execPath,
      PackageManagerArgument.Add,
      Gate.Registry,
      registry,
      Gate.IgnoreScripts,
      Gate.Hoisted,
      Gate.Cache,
      resolve(installation, Gate.CacheDirectory),
      specifier,
    ],
    {
      cwd: installation,
      env,
      stdout: ProcessIo.Inherit,
      stderr: ProcessIo.Inherit,
      timeout: Gate.InstallTimeout,
    },
  );
  const code = await child.exited;
  if (missing) {
    assert.notEqual(code, 0, Gate.MissingDependency);
    return installation;
  }
  assert.equal(code, 0, Gate.InstallFailed);
  return installation;
}

async function installedExample(installation: string, dependencies: Record<string, unknown>) {
  const installed = resolve(installation, Packaging.InstalledPath);
  const project = resolve(installation, Gate.Project);
  await mkdir(project);
  for (const path of publicDirectories.slice(0, 2))
    await cp(resolve(installed, path), resolve(project, path), { recursive: true });
  for (const name of Object.keys(dependencies)) {
    const manifest = ObjectSchema.parse(
      await Bun.file(resolve(installation, HookFile.Dependencies, name, HookFile.Manifest)).json(),
    );
    assert.equal(manifest.version, dependencies[name]);
    if (name !== VendorPackage.CodexCli) await Bun.resolve(name, installed);
  }
  const command = async (args: readonly string[]) => {
    const output = await packageOutput(
      [
        resolve(installation, Packaging.CliPath),
        ...args,
        ProbeOption.Home,
        resolve(installation, Gate.Home),
        CliRuntime.JsonFlag,
      ],
      project,
      inventoryLimits,
    );
    return CliOutputSchema.parse(JSON.parse(output.toString()));
  };
  const doctor = DoctorResultSchema.parse((await command([CliCommand.Doctor])).data);
  assert(
    doctor.prerequisites.some(
      (entry) => entry.name === KnowledgeMeaningLocal.SqliteVec && entry.ready,
    ),
  );
  assert.equal(doctor.model.ready, false);
  for (const name of [PrerequisiteName.Python, PrerequisiteName.Lean]) {
    const tool = doctor.prerequisites.find((entry) => entry.name === name);
    assert(tool && !tool.ready && tool.repair);
  }
  const run = await command([
    CliCommand.Run,
    Gate.ExampleWorkflow,
    ProbeOption.Harness,
    Backend.Fake,
    ProbeOption.FakeScript,
    Gate.ExampleAnswers,
  ]);
  assert.equal(run.state, RunStatus.Passed);
  assert(run.identifiers.run_id);
  return run.identifiers.run_id;
}

async function testRegistry(input: string): Promise<void> {
  const cli = resolve(input, Gate.Archive);
  const archives = [cli, ...(await dependencyArchives(resolve(input, Gate.Dependencies)))];
  const inventory = await registryInventory(archives);
  const bundled = inventory[0];
  assert(bundled && bundled.name === Packaging.CliPackage, Gate.InvalidArchive);
  const dependencies = ObjectSchema.parse(bundled.manifest.dependencies);
  assert(Object.hasOwn(dependencies, KnowledgeMeaningLocal.SqliteVec));
  assert(
    Object.values(dependencies).every(
      (version) =>
        version === String(version) && Packaging.PinnedVersionPattern.test(String(version)),
    ),
  );
  const byPackage = Map.groupBy(inventory, (entry) => entry.name);
  for (const [name, version] of Object.entries(dependencies)) {
    assert(
      byPackage.get(name)?.some((entry) => entry.version === version),
      Gate.InvalidArchive,
    );
  }
  const identities = inventory.map(
    ({ name, version }) => `${name}${Gate.VersionSeparator}${version}`,
  );
  assert.equal(new Set(identities).size, identities.length, Gate.InvalidArchive);
  const work = await mkdtemp(resolve(tmpdir(), Packaging.TemporaryPrefix));
  let omit = true;
  let removedRequests = 0;
  const registry = Bun.serve({
    hostname: Gate.Host,
    port: 0,
    fetch(request, server) {
      const path = decodeURIComponent(new URL(request.url).pathname.slice(1));
      if (omit && path === KnowledgeMeaningLocal.SqliteVec) {
        removedRequests += 1;
        return new Response(null, { status: Gate.MissingStatus });
      }
      const entries = byPackage.get(path);
      if (entries)
        return Response.json({
          name: path,
          [Gate.DistTags]: {
            latest: entries
              .map((entry) => entry.version)
              .sort(Bun.semver.order)
              .at(-1),
          },
          versions: Object.fromEntries(
            entries.map(({ manifest, version, sha256, integrity }) => [
              version,
              {
                ...manifest,
                dist: {
                  integrity,
                  tarball: new URL(
                    `${Gate.Tarball}${PathPart.Separator}${sha256}${Packaging.ArchiveExtension}`,
                    server.url,
                  ).href,
                },
              },
            ]),
          ),
        });
      const entry = inventory.find(
        ({ sha256 }) =>
          path === `${Gate.Tarball}${PathPart.Separator}${sha256}${Packaging.ArchiveExtension}`,
      );
      return entry
        ? new Response(Bun.file(entry.archive))
        : new Response(null, { status: Gate.MissingStatus });
    },
  });
  try {
    const specifier = `${Packaging.CliPackage}${Gate.VersionSeparator}${bundled.version}`;
    await installCase(work, registry.url.href, specifier, true);
    assert(removedRequests > 0, Gate.MissingDependency);
    omit = false;
    const installation = await installCase(work, registry.url.href, specifier, false);
    const registryRun = await installedExample(installation, dependencies);
    const fromArchive = await installCase(work, registry.url.href, cli, false);
    const archiveRun = await installedExample(fromArchive, dependencies);
    console.log(JSON.stringify({ registryRun, archiveRun }));
    console.log(
      JSON.stringify({
        platform: process.platform,
        architecture: process.arch,
        bun: Bun.version,
        missing: KnowledgeMeaningLocal.SqliteVec,
        archives: inventory.map(({ name, version, sha256, manifest }) => ({
          name,
          version,
          sha256,
          license: manifest.license,
        })),
      }),
    );
  } finally {
    await registry.stop(true);
    await rm(work, { recursive: true, force: true });
  }
}

async function isolatedRegistry(archive: string, dependencies: string): Promise<void> {
  const stage = await mkdtemp(resolve(tmpdir(), Packaging.TemporaryPrefix));
  try {
    const cli = resolve(stage, Gate.Archive);
    await copyFile(archive, cli);
    await verifyReleaseArchive(cli);
    const destination = resolve(stage, Gate.Dependencies);
    await mkdir(destination);
    for (const artifact of await dependencyArchives(dependencies))
      await copyFile(artifact, resolve(destination, basename(artifact)));
    const probe = await Bun.build({
      entrypoints: [resolve(root, Gate.Source)],
      outdir: stage,
      naming: Gate.Entry,
      target: Packaging.Target,
    });
    if (!probe.success) throw new AggregateError(probe.logs);
    const child = Bun.spawn(
      [
        OfflineTest.Runtime,
        ...OfflineRunArguments,
        PodmanArgument.Volume,
        `${stage}${TextSymbol.Colon}${Gate.Mount}${PodmanArgument.ReadOnly}`,
        `${PodmanArgument.WorkDirectory}${Gate.Mount}`,
        await imageName(),
        Packaging.Target,
        Gate.Entry,
        Gate.Inside,
      ],
      { stdout: ProcessIo.Inherit, stderr: ProcessIo.Inherit },
    );
    assert.equal(await child.exited, 0, Gate.ContainerFailed);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [, , archive, dependencies] = process.argv;
  if (archive === Gate.Inside) await testRegistry(Gate.Mount);
  else if (archive === Gate.Verify && dependencies)
    await verifyReleaseArchive(resolve(dependencies));
  else {
    assert(archive && dependencies, Gate.Usage);
    await isolatedRegistry(resolve(archive), resolve(dependencies));
  }
}
