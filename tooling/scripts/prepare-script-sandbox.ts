import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, resolve } from "node:path";
import {
  FileEncoding,
  HashAlgorithm,
  HookFile,
  IoLimit,
  PathPart,
  ProcessIo,
  ScriptSandbox,
  TextSymbol,
  WorkspaceMode,
} from "@titan/constants";
import { ScriptSandboxMessage } from "@titan/messages";
import { readBytes } from "@titan/streams";
import { ScriptSandboxInventorySchema } from "@titan/types";

async function run(
  command: string[],
  cwd: string,
  env: Record<string, string | undefined>,
): Promise<void> {
  const child = Bun.spawn(command, {
    cwd,
    env,
    stdin: ProcessIo.Ignore,
    stdout: ProcessIo.Inherit,
    stderr: ProcessIo.Inherit,
  });
  if ((await child.exited) !== 0) throw new Error(ScriptSandboxMessage.PrepareFailed);
}

async function download(url: string, path: string, checksum: string): Promise<void> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(ScriptSandbox.Source.DownloadTimeout),
  });
  if (!response.ok || !response.body) throw new Error(ScriptSandboxMessage.Download);
  const bytes = await readBytes(response.body, ScriptSandbox.Source.DownloadBytes);
  if (createHash(HashAlgorithm.Sha256).update(bytes).digest(FileEncoding.Hex) !== checksum)
    throw new Error(ScriptSandboxMessage.Download);
  await writeFile(path, bytes, { mode: WorkspaceMode.PrivateExecutable });
}

async function cargoProgram(
  cache: string,
  root: string,
  environment: Record<string, string | undefined>,
): Promise<string> {
  const source = ScriptSandbox.Source;
  const installed = Bun.which(source.Cargo);
  if (installed) return installed;
  const target = Object.entries(source.RustTargets).find(([arch]) => arch === process.arch)?.[1];
  const checksum = Object.entries(source.RustChecksums).find(
    ([arch]) => arch === process.arch,
  )?.[1];
  if (!target || !checksum) throw new Error(ScriptSandboxMessage.Unsupported);
  const installer = resolve(cache, source.RustInit);
  environment[source.RustHome] = resolve(cache, source.RustDirectory);
  await download(
    source.RustUrl + target + PathPart.Separator + source.RustInit,
    installer,
    checksum,
  );
  await run([installer, ...source.RustArguments, source.RustVersion], root, environment);
  environment[source.Path] =
    resolve(cache, source.CargoDirectory, source.Bin) +
    delimiter +
    (process.env[source.Path] ?? TextSymbol.Empty);
  return resolve(cache, source.CargoDirectory, source.Bin, source.Cargo);
}

async function verifyComponents(
  root: string,
  directory: string,
  cargo: string,
  environment: Record<string, string | undefined>,
): Promise<void> {
  const source = ScriptSandbox.Source;
  const inventory = ScriptSandboxInventorySchema.parse(
    await Bun.file(resolve(root, source.Inventory)).json(),
  );
  const lock = createHash(HashAlgorithm.Sha256)
    .update(await readFile(resolve(directory, source.Lock)))
    .digest(FileEncoding.Hex);
  if (inventory.source_sha256 !== source.Sha256 || inventory.lock_sha256 !== lock)
    throw new Error(ScriptSandboxMessage.Distribution);
  const child = Bun.spawn([cargo, ...source.Components], {
    cwd: directory,
    env: environment,
    stdout: ProcessIo.Pipe,
    stderr: ProcessIo.Inherit,
  });
  const output = await readBytes(child.stdout, IoLimit.DataBytes);
  if ((await child.exited) !== 0) throw new Error(ScriptSandboxMessage.PrepareFailed);
  const actual = new Set(
    output
      .toString(FileEncoding.Utf8)
      .trim()
      .split(TextSymbol.Newline)
      .map((line) => line.split(TextSymbol.Space).slice(0, 2).join(TextSymbol.Space)),
  );
  const expected = new Set(
    inventory.components.map(
      (component) =>
        component.name + TextSymbol.Space + ScriptSandbox.Source.VersionPrefix + component.version,
    ),
  );
  if (actual.size !== expected.size || [...actual].some((component) => !expected.has(component)))
    throw new Error(ScriptSandboxMessage.Distribution);
}

export async function prepareScriptSandbox(root: string, destination?: string): Promise<void> {
  if (process.platform !== ScriptSandbox.Linux) return;
  const source = ScriptSandbox.Source;
  const cache = resolve(root, source.Cache);
  const executable = resolve(cache, source.Bin, ScriptSandbox.Binary);
  const environment: Record<string, string | undefined> = {
    ...process.env,
    [source.CargoHome]: resolve(cache, source.CargoDirectory),
  };
  await mkdir(cache, { recursive: true });
  const stamp = resolve(cache, source.Stamp);
  const flags = [
    ...source.Strip,
    source.Remap + homedir() + source.HomeRemapTarget,
    source.Remap + cache + source.RemapTarget,
  ].join(source.FlagSeparator);
  const patch = resolve(root, source.Patch);
  const patchHash = createHash(HashAlgorithm.Sha256)
    .update(await readFile(patch))
    .digest(FileEncoding.Hex);
  const inventoryHash = createHash(HashAlgorithm.Sha256)
    .update(await readFile(resolve(root, source.Inventory)))
    .digest(FileEncoding.Hex);
  const identity = [
    ScriptSandbox.Version,
    process.arch,
    source.Sha256,
    patchHash,
    inventoryHash,
    flags,
  ].join(TextSymbol.Colon);
  const prepared = await Bun.file(stamp)
    .text()
    .catch(() => undefined);
  if (!(await Bun.file(executable).exists()) || prepared !== identity) {
    console.log(ScriptSandboxMessage.Build);
    const archive = resolve(cache, source.Crate);
    await download(source.Url, archive, source.Sha256);
    await rm(resolve(cache, source.Directory), { recursive: true, force: true });
    await run(
      [source.Tar, ...source.Extract, archive, source.DirectoryArgument, cache],
      root,
      environment,
    );
    const directory = resolve(cache, source.Directory);
    await run([source.PatchProgram, ...source.PatchArguments, patch], directory, environment);
    const cargo = await cargoProgram(cache, root, environment);
    await run([cargo, ...source.Install], directory, {
      ...environment,
      [source.RustFlags]: flags,
    });
    await verifyComponents(root, directory, cargo, environment);
    await mkdir(resolve(cache, source.Bin), { recursive: true });
    await cp(resolve(directory, source.Output), executable);
  }
  await writeFile(stamp, identity, { mode: WorkspaceMode.PrivateFile });
  if (!destination) return;
  await cp(executable, resolve(destination, ScriptSandbox.Binary));
  await cp(resolve(root, source.Notices), resolve(destination, source.NoticesOutput));
  await cp(resolve(root, source.Inventory), resolve(destination, source.InventoryOutput));
  await cp(
    resolve(cache, source.Directory, source.License),
    resolve(destination, source.LicenseOutput),
  );
  await run(
    [
      source.Tar,
      ...source.ArchiveArguments,
      resolve(destination, source.Archive),
      source.DirectoryArgument,
      cache,
      source.Directory,
    ],
    root,
    environment,
  );
}

if (import.meta.main) await prepareScriptSandbox(resolve(import.meta.dir, HookFile.RepositoryRoot));
