import { lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
  AgentTool,
  ClaudeShellGuard,
  ErrorField,
  FileAccessMode,
  FileErrorCode,
  PathPart,
  WorkspaceExcluded,
  WorkspaceFileLinks,
} from "@titan/constants";
import {
  type AgentFileScope,
  ClaudeBashInputSchema,
  ClaudeGlobInputSchema,
  ClaudeGrepInputSchema,
  ObjectSchema,
} from "@titan/types/agents";
import { WorkspaceEntryNameSchema, WorkspacePathSchema } from "@titan/types/workspace";

async function unlinked(path: string, writable = false): Promise<boolean> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) return false;
    return !writable || (metadata.isFile() && metadata.nlink === WorkspaceFileLinks);
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return true;
    if (
      error instanceof Error &&
      Reflect.get(error, ErrorField.Code) === FileErrorCode.NotDirectory
    )
      return false;
    throw error;
  }
}

async function confined(cwd: string, file: unknown, writable = false): Promise<boolean> {
  const parsed = WorkspacePathSchema.safeParse(file);
  if (!parsed.success) return false;
  if (
    parsed.data.includes(PathPart.Backslash) ||
    parsed.data.split(PathPart.Separator).includes(PathPart.Parent)
  )
    return false;
  const absolute = resolve(cwd, parsed.data);
  const path = relative(cwd, absolute);
  if (path === PathPart.Parent || path.startsWith(PathPart.ParentPrefix) || isAbsolute(path))
    return false;
  if (
    path &&
    !path
      .split(PathPart.Separator)
      .every((part) => WorkspaceEntryNameSchema.safeParse(part).success)
  )
    return false;
  let current = cwd;
  if (!(await unlinked(current))) return false;
  for (const component of path.split(PathPart.Separator)) {
    current = resolve(current, component);
    if (!(await unlinked(current, writable && current === absolute))) return false;
  }
  return true;
}
export async function claudeToolAllowed(
  cwd: string,
  name: string,
  input: unknown,
  scope?: AgentFileScope,
): Promise<boolean> {
  const parsed = ObjectSchema.safeParse(input);
  if (!parsed.success) return false;
  const args = parsed.data;
  if (name === AgentTool.Bash) return claudeShellAllowed(cwd, args);
  if (name === AgentTool.Read || name === AgentTool.Write || name === AgentTool.Edit)
    return (
      (name === AgentTool.Read || scopedWrite(cwd, args.file_path, scope)) &&
      (await confined(cwd, args.file_path, name !== AgentTool.Read))
    );
  if (name === AgentTool.Glob && !ClaudeGlobInputSchema.safeParse(args).success) return false;
  if (name === AgentTool.Grep && !ClaudeGrepInputSchema.safeParse(args).success) return false;
  return confined(cwd, args.path === undefined ? PathPart.Current : args.path);
}

function scopedWrite(cwd: string, file: unknown, scope?: AgentFileScope): boolean {
  if (!scope) return true;
  const parsed = WorkspacePathSchema.safeParse(file);
  if (!parsed.success || scope.mode !== FileAccessMode.Write) return false;
  const target = resolve(cwd, parsed.data);
  if (
    scope.exclude_paths?.some(
      (path) =>
        target === resolve(cwd, path) || target.startsWith(resolve(cwd, path) + PathPart.Separator),
    )
  )
    return false;
  return scope.paths.some((path) => {
    const allowed = resolve(cwd, path);
    return target === allowed || target.startsWith(allowed + PathPart.Separator);
  });
}

function climb(parts: readonly string[], depth: number): number {
  let level = depth;
  for (const part of parts) {
    if (part === PathPart.Parent) level -= 1;
    else if (part && part !== PathPart.Current) level += 1;
    if (level < 0) return level;
  }
  return level;
}

function shellWord(cwd: string, word: string, depth: number): boolean {
  const parts = word.split(PathPart.Separator);
  if (ClaudeShellGuard.Programs.some((program) => program === parts[parts.length - 1]))
    return false;
  if (parts.some((part) => WorkspaceExcluded.includes(part))) return false;
  if (word.startsWith(PathPart.Separator)) return word.startsWith(cwd + PathPart.Separator);
  return climb(parts, depth) >= 0;
}

function claudeShellAllowed(cwd: string, input: unknown): boolean {
  const parsed = ClaudeBashInputSchema.safeParse(input);
  if (!parsed.success || ClaudeShellGuard.Expansion.test(parsed.data.command)) return false;
  const assigned = new Set(
    [...parsed.data.command.matchAll(ClaudeShellGuard.Assignment)].map((match) => match[1]),
  );
  const references = [...parsed.data.command.matchAll(ClaudeShellGuard.Reference)];
  if (references.some((match) => !assigned.has(match[1]))) return false;
  let depth = 0;
  for (const statement of parsed.data.command
    .replace(ClaudeShellGuard.Quotes, ClaudeShellGuard.Empty)
    .split(ClaudeShellGuard.Statements)) {
    const words = statement.split(ClaudeShellGuard.Words).filter(Boolean);
    const changing = words[0] === ClaudeShellGuard.Change;
    if (changing && words.length < 2) return false;
    for (const word of words) if (!shellWord(cwd, word, depth)) return false;
    if (changing && words[1]) depth = climb(words[1].split(PathPart.Separator), depth);
  }
  return true;
}
