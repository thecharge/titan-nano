import { lstat, opendir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import {
  ErrorCode,
  ErrorField,
  FileEncoding,
  FileErrorCode,
  IoLimit,
  PathPart,
  TextSymbol,
  WorkspaceFileLinks,
  WorkspaceSkill,
  WorkspaceSkillScope,
} from "@titan/constants";
import { hash, jsonByteLength } from "@titan/core";
import { TitanError } from "@titan/errors";
import { readFileBytes } from "@titan/streams";
import {
  type DiscoveredWorkspaceSkill,
  WorkspaceEntryNameSchema,
  WorkspaceRelativePathSchema,
  WorkspaceSkillMetadataSchema,
} from "@titan/types";

const harnessRoots = WorkspaceSkill.Roots;

function contained(root: string, path: string): boolean {
  const local = relative(root, path);
  return (
    !isAbsolute(local) && local !== PathPart.Parent && !local.startsWith(PathPart.ParentPrefix)
  );
}

async function canonical(path: string): Promise<string | undefined> {
  try {
    return await realpath(path);
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return undefined;
    throw error;
  }
}

async function skillFile(root: string, path: string) {
  const file = await canonical(resolve(root, path));
  if (
    !file ||
    !contained(root, file) ||
    !WorkspaceRelativePathSchema.safeParse(relative(root, file)).success
  )
    throw new TitanError(ErrorCode.UnsafePath, path);
  const info = await lstat(file);
  if (!info.isFile() || info.nlink !== WorkspaceFileLinks)
    throw new TitanError(ErrorCode.UnsafePath, path);
  const contents = await readFileBytes(file, IoLimit.DataBytes);
  if ((await canonical(resolve(root, path))) !== file)
    throw new TitanError(ErrorCode.SnapshotChanged, path);
  return {
    content: new TextDecoder(FileEncoding.Utf8, { fatal: true, ignoreBOM: true }).decode(contents),
    hash: hash(contents),
  };
}

export async function discoverWorkspaceSkills(
  project: string,
  environment: Record<string, string | undefined>,
) {
  const projectRoot = await realpath(project);
  const home = environment.HOME || homedir();
  const userRoots = [
    resolve(home, harnessRoots[0]),
    resolve(environment.CODEX_HOME || resolve(home, harnessRoots[1])),
    resolve(environment.CLAUDE_CONFIG_DIR || resolve(home, harnessRoots[2])),
  ];
  const roots = [
    ...harnessRoots.map((root) => ({
      root: resolve(projectRoot, root),
      scope: WorkspaceSkillScope.Project,
    })),
    ...userRoots.map((root) => ({ root, scope: WorkspaceSkillScope.User })),
  ];
  const catalog = new Map<string, DiscoveredWorkspaceSkill>();
  let entries = 0;
  let instructionBytes = 0;
  for (const { root, scope } of roots) {
    const originRoot = resolve(root, WorkspaceSkill.Directory);
    const folder = await canonical(originRoot);
    const boundary = scope === WorkspaceSkillScope.Project ? projectRoot : await canonical(root);
    if (!folder || !boundary || !contained(boundary, folder)) continue;
    for await (const entry of await opendir(folder)) {
      if (++entries > WorkspaceSkill.Entries) throw new TitanError(ErrorCode.Capacity, originRoot);
      if (
        !WorkspaceEntryNameSchema.safeParse(entry.name).success ||
        (!entry.isDirectory() && !entry.isSymbolicLink())
      )
        continue;
      const origin = resolve(originRoot, entry.name);
      const directory = await canonical(resolve(folder, entry.name));
      if (!directory || !contained(boundary, directory)) continue;
      const instruction = await canonical(resolve(directory, WorkspaceSkill.Instructions));
      if (!instruction || !contained(directory, instruction)) continue;
      const existing = catalog.get(entry.name);
      if (existing) {
        if (existing.origin !== origin && !existing.alternatives.includes(origin))
          existing.alternatives.push(origin);
        continue;
      }
      const { content } = await skillFile(directory, WorkspaceSkill.Instructions);
      instructionBytes += Buffer.byteLength(content);
      if (instructionBytes > IoLimit.ResponseBytes)
        throw new TitanError(ErrorCode.Capacity, originRoot);
      const frontMatter = WorkspaceSkill.Header.exec(content)?.[1];
      const metadata = frontMatter === undefined ? undefined : Bun.YAML.parse(frontMatter);
      const description =
        WorkspaceSkillMetadataSchema.safeParse(metadata).data?.description ?? TextSymbol.Empty;
      catalog.set(entry.name, {
        name: entry.name,
        description,
        scope,
        origin,
        alternatives: [],
        directory,
      });
    }
  }
  return new Map([...catalog].sort(([left], [right]) => left.localeCompare(right)));
}

export async function retainWorkspaceSkills(
  project: string,
  environment: Record<string, string | undefined>,
  selected: ReadonlySet<string>,
) {
  const catalog = await discoverWorkspaceSkills(project, environment);
  for (const name of selected)
    if (!catalog.has(name)) throw new TitanError(ErrorCode.Arguments, name);
  const index = [];
  const files = [];
  let bytes = 0;
  let entries = 0;
  for (const { directory, ...entry } of catalog.values()) {
    index.push(entry);
    if (!selected.has(entry.name)) continue;
    const pending: string[] = [WorkspaceSkill.Instructions, WorkspaceSkill.References];
    for (const path of pending) {
      if (++entries > WorkspaceSkill.Entries) throw new TitanError(ErrorCode.Capacity, entry.name);
      const target = await canonical(resolve(directory, path));
      if (!target || !contained(directory, target)) continue;
      if ((await lstat(target)).isDirectory()) {
        if (target !== resolve(directory, path)) continue;
        for await (const item of await opendir(target)) {
          if (pending.length >= WorkspaceSkill.Entries)
            throw new TitanError(ErrorCode.Capacity, entry.name);
          const child = path + PathPart.Separator + item.name;
          if (WorkspaceRelativePathSchema.safeParse(child).success) pending.push(child);
        }
        continue;
      }
      const file = await skillFile(directory, path);
      bytes += Buffer.byteLength(file.content);
      if (bytes > IoLimit.DataBytes) throw new TitanError(ErrorCode.Capacity, entry.name);
      files.push({ name: entry.name, path, ...file });
    }
  }
  const retained = { index, files };
  jsonByteLength(retained, IoLimit.DataBytes);
  return retained;
}

export async function showWorkspaceSkill(
  project: string,
  environment: Record<string, string | undefined>,
  name: string,
) {
  const skill = (await discoverWorkspaceSkills(project, environment)).get(name);
  if (!skill) throw new TitanError(ErrorCode.Arguments, name);
  const { directory, ...entry } = skill;
  return { ...entry, ...(await skillFile(directory, WorkspaceSkill.Instructions)) };
}
