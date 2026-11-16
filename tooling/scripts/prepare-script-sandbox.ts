import { createHash } from "node:crypto";
import { cp, mkdir, readlink, symlink, writeFile } from "node:fs/promises";
import { delimiter, resolve } from "node:path";
import {
  FileEncoding,
  HashAlgorithm,
  HookFile,
  PathPart,
  ProcessIo,
  ScriptSandbox,
  TextSymbol,
  WorkspaceMode,
} from "@titan/constants";
import { ScriptSandboxMessage } from "@titan/messages";
import { readBytes } from "@titan/streams";

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

async function linkerDirectory(cache: string): Promise<string> {
  const source = ScriptSandbox.Source;
  const linker = resolve(cache, source.Linker);
  await mkdir(linker, { recursive: true });
  for (const pattern of source.LibraryPatterns) {
    const library = (await Array.fromAsync(new Bun.Glob(pattern).scan()))[0];
    if (!library) continue;
    const alias = resolve(linker, source.Library);
    const existing = await readlink(alias).catch(() => undefined);
    if (existing !== library) await symlink(library, alias);
    return linker;
  }
  throw new Error(ScriptSandboxMessage.PrepareFailed);
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
  const identity = ScriptSandbox.Version + TextSymbol.Colon + process.arch;
  const prepared = await Bun.file(stamp)
    .text()
    .catch(() => undefined);
  if (!(await Bun.file(executable).exists()) || prepared !== identity) {
    console.log(ScriptSandboxMessage.Build);
    const archive = resolve(cache, source.Crate);
    await download(source.Url, archive, source.Sha256);
    await run(
      [source.Tar, ...source.Extract, archive, source.DirectoryArgument, cache],
      root,
      environment,
    );
    const cargo = await cargoProgram(cache, root, environment);
    const linker = await linkerDirectory(cache);
    await run(
      [
        cargo,
        ...source.Install,
        resolve(cache, source.Directory),
        source.Root,
        cache,
        source.BinaryArgument,
        ScriptSandbox.Binary,
      ],
      root,
      { ...environment, [source.LibraryPath]: linker, [source.RustFlags]: source.Strip },
    );
  }
  await writeFile(stamp, identity, { mode: WorkspaceMode.PrivateFile });
  if (!destination) return;
  await cp(executable, resolve(destination, ScriptSandbox.Binary));
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
      ...source.Sources,
    ],
    root,
    environment,
  );
}

if (import.meta.main) await prepareScriptSandbox(resolve(import.meta.dir, HookFile.RepositoryRoot));
