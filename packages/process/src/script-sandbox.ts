import { lstat, mkdir, mkdtemp, opendir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import {
  AgentHost,
  ConfigDefault,
  ErrorCode,
  ErrorField,
  FileErrorCode,
  IoLimit,
  NativeWritePolicy,
  PathPart,
  ScriptExecution,
  ScriptSandbox,
  TextSymbol,
  WorkspaceExcluded,
  WorkspaceFile,
  WorkspaceFileLinks,
  WorkspaceMode,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { ScriptSandboxMessage } from "@titan/messages";
import { WorkspaceRelativePathSchema } from "@titan/types";

async function metadata(path: string) {
  return lstat(path).catch((error: unknown) => {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return undefined;
    throw error;
  });
}

function inside(root: string, path: string): boolean {
  return path === root || path.startsWith(root + PathPart.Separator);
}

function macRule(prefix: string, path: string, tree: boolean): string {
  return (
    prefix +
    (tree ? ScriptSandbox.MacTree : ScriptSandbox.MacLiteral) +
    JSON.stringify(path) +
    ScriptSandbox.Close +
    ScriptSandbox.Close
  );
}

async function children(path: string, queue: string[]): Promise<void> {
  const directory = await opendir(path);
  for await (const child of directory) {
    if (queue.length >= ConfigDefault.MaxWorkspaceEntriesLimit)
      throw new OperationalError(ErrorCode.Capacity, ScriptSandboxMessage.Capacity);
    queue.push(resolve(path, child.name));
  }
}

async function inspect(root: string, paths: readonly string[], excluded: readonly string[]) {
  const queue = [...paths];
  const denied = new Set<string>(excluded);
  for (const path of queue) {
    if (queue.length > ConfigDefault.MaxWorkspaceEntriesLimit)
      throw new OperationalError(ErrorCode.Capacity, ScriptSandboxMessage.Capacity);
    const name = relative(root, path);
    if (!inside(root, path))
      throw new OperationalError(ErrorCode.PermissionDenied, ScriptSandboxMessage.Unsafe);
    if (name && !WorkspaceRelativePathSchema.safeParse(name).success) {
      denied.add(path);
      continue;
    }
    if (excluded.some((entry) => inside(entry, path))) continue;
    const entry = await metadata(path);
    if (!entry) continue;
    if (
      (!entry.isDirectory() && !entry.isFile()) ||
      (entry.isFile() && entry.nlink !== WorkspaceFileLinks)
    ) {
      denied.add(path);
      continue;
    }
    if (!entry.isDirectory()) continue;
    await children(path, queue);
  }
  return denied;
}

function protectedParents(root: string, paths: readonly string[]): string[] {
  const result = new Set<string>([root]);
  for (const path of paths) {
    let parent = dirname(path);
    while (inside(root, parent) && parent !== root) {
      result.add(parent);
      parent = dirname(parent);
    }
  }
  return [...result];
}

function linuxPolicy(
  root: string,
  allow: readonly string[],
  ancestors: readonly string[],
  blocked: readonly string[],
  structural: readonly string[],
  temporary: string,
): string {
  return JSON.stringify({
    root,
    allow,
    ancestors,
    blocked,
    structural,
    temporary,
    names: [...new Set([...WorkspaceExcluded, ...NativeWritePolicy.Metadata])],
  });
}

function macPolicy(
  root: string,
  allow: readonly string[],
  ancestors: readonly string[],
  blocked: readonly string[],
  structural: readonly string[],
): string {
  const names = [...new Set([...WorkspaceExcluded, ...NativeWritePolicy.Metadata])].map((name) =>
    name.replace(ScriptSandbox.RegexEscape, ScriptSandbox.Escape),
  );
  names.push(ScriptSandbox.EnvironmentRegex);
  const pattern =
    ScriptSandbox.RegexStart +
    root.replace(ScriptSandbox.RegexEscape, ScriptSandbox.Escape) +
    ScriptSandbox.RegexParents +
    names.join(ScriptSandbox.RegexChoice) +
    ScriptSandbox.RegexEnd;
  return [
    ScriptSandbox.MacStart,
    ...allow.map((path) => macRule(ScriptSandbox.MacAllow, path, true)),
    ...ancestors.map((path) => macRule(ScriptSandbox.MacParent, path, false)),
    ...blocked.map((path) => macRule(ScriptSandbox.MacDeny, path, true)),
    ...structural.map((path) => macRule(ScriptSandbox.MacStructure, path, false)),
    ScriptSandbox.MacRegex + JSON.stringify(pattern) + ScriptSandbox.Close + ScriptSandbox.Close,
  ].join(TextSymbol.Empty);
}

async function parents(root: string, paths: readonly string[]): Promise<string[]> {
  const result = new Set<string>();
  for (const path of paths) {
    let parent = dirname(path);
    while (inside(root, parent) && parent !== root && !(await metadata(parent))) {
      result.add(parent);
      parent = dirname(parent);
    }
  }
  return [...result];
}

export async function scriptSandbox(
  root: string,
  paths: readonly string[],
  excluded: readonly string[],
  script: string,
  platform: string = process.platform,
  executable: string = import.meta.path.endsWith(AgentHost.SourceExtension)
    ? resolve(import.meta.dir, ScriptSandbox.SourceBinary)
    : resolve(import.meta.dir, ScriptSandbox.Binary),
) {
  if (platform !== ScriptSandbox.Linux && platform !== ScriptSandbox.Mac)
    throw new OperationalError(ErrorCode.PermissionDenied, ScriptSandboxMessage.Unsupported);
  root = await realpath(root);
  const denied = await inspect(root, paths, excluded);
  const ancestors = await parents(root, paths);
  const directory = await mkdtemp(resolve(tmpdir(), ScriptSandbox.Prefix));
  const temporary = resolve(directory, ScriptSandbox.Temporary);
  const close = () => rm(directory, { recursive: true, force: true });
  try {
    await mkdir(temporary, { mode: WorkspaceMode.PrivateExecutable });
    const allow = [...paths, temporary, ScriptSandbox.Null];
    const blocked = [...denied];
    for (const name of new Set([...WorkspaceExcluded, ...NativeWritePolicy.Metadata]))
      blocked.push(resolve(root, name));
    blocked.push(resolve(root, WorkspaceFile.Environment));
    const structural = protectedParents(root, blocked);
    const policy =
      platform === ScriptSandbox.Linux
        ? linuxPolicy(root, allow, ancestors, blocked, structural, temporary)
        : macPolicy(root, allow, ancestors, blocked, structural);
    if (Buffer.byteLength(policy) > IoLimit.DataBytes)
      throw new OperationalError(ErrorCode.Capacity, ScriptSandboxMessage.Capacity);
    if (platform === ScriptSandbox.Linux && !(await metadata(executable))?.isFile())
      throw new OperationalError(ErrorCode.PermissionDenied, ScriptSandboxMessage.Missing);
    const file = resolve(directory, ScriptSandbox.Policy);
    await writeFile(file, policy, {
      mode: WorkspaceMode.PrivateFile,
    });
    const command =
      platform === ScriptSandbox.Linux
        ? [
            executable,
            ScriptSandbox.Run,
            ScriptSandbox.Root,
            PathPart.Separator,
            ScriptSandbox.Read,
            PathPart.Separator,
            ScriptSandbox.WorkingDirectory,
            root,
            ...ScriptSandbox.Network,
            ...allow.flatMap((path) => [ScriptSandbox.Write, path]),
            ScriptSandbox.File,
            file,
            ScriptSandbox.Separator,
            ScriptSandbox.EnvBinary,
            ScriptSandbox.TemporaryEnvironment + temporary,
            ...ScriptExecution.Shell,
            script,
          ]
        : [
            ScriptSandbox.MacBinary,
            ScriptSandbox.MacProfile,
            policy,
            ScriptSandbox.EnvBinary,
            ScriptSandbox.TemporaryEnvironment + temporary,
            ...ScriptExecution.Shell,
            script,
          ];
    return { command, close };
  } catch (error) {
    await close();
    throw error;
  }
}
