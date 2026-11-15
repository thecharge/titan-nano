import { dirname, relative, resolve } from "node:path";
import { FileEncoding, HookFile, IoLimit, TypeScriptPolicy } from "@titan/constants";
import { invalidTypeScriptPolicy, typeScriptPolicySummary } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import {
  PackageTypeScriptPolicySchema,
  RootTypeScriptPolicySchema,
  TypeScriptWorkspacePolicySchema,
} from "@titan/types";

export async function validRootTypeScriptPolicy(value: unknown): Promise<boolean> {
  return RootTypeScriptPolicySchema.safeParse(value).success;
}

export async function validPackageTypeScriptPolicy(
  value: unknown,
  parent: string,
  source: string = TypeScriptPolicy.PackageSource,
): Promise<boolean> {
  const parsed = PackageTypeScriptPolicySchema.safeParse(value);
  return parsed.success && parsed.data.extends === parent && parsed.data.include[0] === source;
}

async function document(path: string): Promise<unknown> {
  return JSON.parse((await readFileBytes(path, IoLimit.DataBytes)).toString(FileEncoding.Utf8));
}

async function inspectWorkspaceConfig(root: string, file: string, config: string): Promise<string> {
  const path = resolve(root, dirname(file), TypeScriptPolicy.File);
  const parent = relative(dirname(path), config);
  const source =
    dirname(file) === TypeScriptPolicy.TestingWorkspace
      ? TypeScriptPolicy.TestingSource
      : TypeScriptPolicy.PackageSource;
  if (!(await validPackageTypeScriptPolicy(await document(path), parent, source)))
    throw new Error(invalidTypeScriptPolicy(path));
  return path;
}

async function inspectWorkspacePattern(
  root: string,
  pattern: string,
  config: string,
  selected: Set<string>,
): Promise<void> {
  let count = 0;
  for await (const file of new Bun.Glob(pattern + HookFile.ManifestSuffix).scan({ cwd: root })) {
    const path = await inspectWorkspaceConfig(root, file, config);
    selected.add(path);
    if (selected.size > TypeScriptPolicy.MaximumWorkspaces)
      throw new Error(invalidTypeScriptPolicy(path));
    count++;
  }
  if (!count) throw new Error(invalidTypeScriptPolicy(pattern));
}

export async function checkTypeScriptPolicy(
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
): Promise<number> {
  const config = resolve(root, TypeScriptPolicy.File);
  if (!(await validRootTypeScriptPolicy(await document(config))))
    throw new Error(invalidTypeScriptPolicy(config));
  const manifest = TypeScriptWorkspacePolicySchema.parse(
    await document(resolve(root, HookFile.Manifest)),
  );
  const selected = new Set<string>();
  for (const pattern of manifest.workspaces.packages)
    await inspectWorkspacePattern(root, pattern, config, selected);
  console.log(typeScriptPolicySummary(selected.size));
  return selected.size;
}

if (import.meta.main) await checkTypeScriptPolicy();
