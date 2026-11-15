import {
  Development,
  GitFileMode,
  GitHookArgument,
  GitHookFormat,
  HookCheckScope,
  HookCommand,
  HookDocumentation,
  HookLimit,
  PathPart,
  TextSymbol,
} from "@titan/constants";
import {
  GitObjectSchema,
  type HookChange,
  HookChangeHeaderSchema,
  HookChangeSchema,
} from "@titan/types";
import { commandOutput } from "./hook-process.ts";

export function parseHookChanges(value: string): HookChange[] | null {
  if (Buffer.byteLength(value) > HookLimit.OutputBytes) return null;
  const fields = value.split(GitHookFormat.Null);
  if (fields.pop() !== TextSymbol.Empty) return null;
  const changes: HookChange[] = [];
  for (let index = 0; index < fields.length; index += 2) {
    const header = fields[index];
    const parsed = HookChangeHeaderSchema.safeParse(
      header?.slice(1).split(GitHookFormat.Whitespace),
    );
    if (!header?.startsWith(TextSymbol.Colon) || !parsed.success) return null;
    const [old_mode, new_mode, , , kind] = parsed.data;
    const change = HookChangeSchema.safeParse({
      path: fields[index + 1],
      old_mode,
      new_mode,
      kind,
    });
    if (!change.success || changes.length >= HookLimit.ChangedFiles) return null;
    changes.push(change.data);
  }
  return changes;
}

export function hookScope(
  changes: readonly HookChange[],
  owners: readonly string[],
): HookCheckScope {
  if (!changes.length) return HookCheckScope.Full;
  const documentation = changes.every((change) => {
    if (
      ![change.old_mode, change.new_mode].every(
        (mode) => mode === GitFileMode.Regular || mode === GitFileMode.Absent,
      )
    )
      return false;
    if (change.path === Development.AcceptanceMap) return true;
    if (HookDocumentation.Passive.some((directory) => change.path.startsWith(directory)))
      return HookDocumentation.PathPattern.test(change.path);
    if (!change.path.endsWith(HookDocumentation.Extension)) return false;
    return (
      change.path === HookDocumentation.Readme ||
      HookDocumentation.Directories.some((directory) => change.path.startsWith(directory)) ||
      owners.some(
        (owner) => change.path === `${owner}${PathPart.Separator}${HookDocumentation.Readme}`,
      )
    );
  });
  return documentation ? HookCheckScope.Documentation : HookCheckScope.Full;
}

export async function readHookChanges(
  root: string,
  tree: string,
  base: string | null,
): Promise<HookChange[] | null> {
  if (base === null) return null;
  try {
    const parent = GitObjectSchema.parse(
      await commandOutput(
        [HookCommand.Git, ...GitHookArgument.Verify, base + GitHookArgument.TreeSuffix],
        { cwd: root },
      ),
    );
    const proposed = GitObjectSchema.parse(tree);
    return parseHookChanges(
      await commandOutput([HookCommand.Git, ...GitHookArgument.Changes, parent, proposed], {
        cwd: root,
        raw: true,
      }),
    );
  } catch {
    return null;
  }
}
