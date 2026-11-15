import { mkdir, readdir, realpath, symlink } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import {
  BoundaryReadLimit,
  FileEncoding,
  HookDependencyPath,
  HookFile,
  HookLimit,
  HookToolchain,
  TextSymbol,
} from "@titan/constants";
import { HookMessage } from "@titan/messages";
import { type HookManifest, HookManifestSchema, type HookWorkspace } from "@titan/types";
import { readInventoryBytes } from "./inventory-bytes.ts";
import { readWorkspaces } from "./workspaces.ts";

async function link(target: string, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await symlink(target, path);
}

async function dependencyTarget(root: string, name: string, version: string): Promise<string> {
  try {
    const target = await realpath(
      join(root, HookFile.Dependencies, HookDependencyPath.Cache, HookFile.Dependencies, name),
    );
    const installed = HookManifestSchema.parse(
      JSON.parse(
        (
          await readInventoryBytes(join(target, HookFile.Manifest), BoundaryReadLimit.ManifestBytes)
        ).toString(FileEncoding.Utf8),
      ),
    );
    if (installed.name !== name || installed.version !== version)
      throw new Error(HookMessage.MissingDependencies);
    return target;
  } catch {
    throw new Error(HookMessage.MissingDependencies);
  }
}

async function workspaceDependency(
  snapshot: string,
  packages: readonly HookWorkspace[],
  name: string,
): Promise<string> {
  const target = packages.find((item) => item.manifest.name === name);
  if (!target) throw new Error(HookMessage.MissingDependencies);
  return join(snapshot, target.directory);
}

async function linkWorkspace(
  root: string,
  snapshot: string,
  packages: readonly HookWorkspace[],
  owner: HookWorkspace,
  catalog: HookManifest,
): Promise<void> {
  const dependencies = { ...owner.manifest.dependencies, ...owner.manifest.devDependencies };
  for (const [name, version] of Object.entries(dependencies)) {
    const resolvedVersion =
      version === HookToolchain.Catalog ? catalog.workspaces?.catalog[name] : version;
    if (!resolvedVersion) throw new Error(HookMessage.MissingDependencies);
    const workspace = version.startsWith(HookToolchain.Workspace);
    const target = workspace
      ? await workspaceDependency(snapshot, packages, name)
      : await dependencyTarget(root, name, resolvedVersion);
    const path = join(snapshot, owner.directory, HookFile.Dependencies, name);
    await link(workspace ? relative(dirname(path), target) : target, path);
  }
}

async function linkBinaries(root: string, snapshot: string): Promise<void> {
  const cache = await realpath(join(root, HookFile.Dependencies, HookDependencyPath.Cache));
  const directory = join(root, HookFile.Dependencies, HookDependencyPath.Binaries);
  const targetDirectory = join(snapshot, HookFile.Dependencies, HookDependencyPath.Binaries);
  await mkdir(targetDirectory, { recursive: true });
  for (const name of await readdir(directory)) {
    const target = await realpath(join(directory, name));
    if (!target.startsWith(cache + sep)) throw new Error(HookMessage.MissingDependencies);
    await link(target, join(targetDirectory, name));
  }
}

export async function linkOutgoingDependencies(
  root: string,
  snapshot: string,
  tip: boolean,
): Promise<void> {
  if (tip) return linkSnapshotDependencies(root, snapshot);
  await link(join(root, HookFile.Dependencies), join(snapshot, HookFile.Dependencies));
}

export async function linkSnapshotDependencies(root: string, snapshot: string): Promise<void> {
  const lock = await readInventoryBytes(join(root, HookFile.Lock), HookLimit.LockBytes);
  if (!lock.equals(await readInventoryBytes(join(snapshot, HookFile.Lock), HookLimit.LockBytes)))
    throw new Error(HookMessage.MissingDependencies);
  const packages = await readWorkspaces(snapshot);
  if (new Set(packages.map((owner) => owner.manifest.name)).size !== packages.length)
    throw new Error(HookMessage.MissingDependencies);
  const catalog = packages.find((item) => item.directory === TextSymbol.Dot)?.manifest;
  if (!catalog) throw new Error(HookMessage.MissingDependencies);
  if (catalog.packageManager !== HookToolchain.PackageManagerPrefix + Bun.version)
    throw new Error(HookMessage.WrongRuntime);
  for (const owner of packages) await linkWorkspace(root, snapshot, packages, owner, catalog);
  await link(
    await realpath(join(root, HookFile.Dependencies, HookDependencyPath.Cache)),
    join(snapshot, HookFile.Dependencies, HookDependencyPath.Cache),
  );
  await linkBinaries(root, snapshot);
}
