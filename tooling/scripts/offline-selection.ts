import { lstat, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import {
  FlatTestRule,
  HookFile,
  OfflineSelectionLimit,
  OfflineTestRoots,
  PathPart,
  TestLayout,
} from "@titan/constants";
import { OfflineMessage } from "@titan/messages";
import {
  type OfflineSelectionLimits,
  type OfflineSelectionLimitsInput,
  OfflineSelectionLimitsSchema,
  OfflineTestArgumentsSchema,
} from "@titan/types";

async function offlineInventory(root: string, limits: OfflineSelectionLimits) {
  const files: string[] = [];
  const glob = new Bun.Glob(OfflineSelectionLimit.Pattern);
  let entries = 0;
  for await (const name of glob.scan({
    cwd: root,
    onlyFiles: false,
    followSymlinks: false,
    dot: true,
  })) {
    if (++entries > limits.max_entries) throw new Error(OfflineMessage.Selection);
    if (!TestLayout.TierPrefixes.some((tier) => name.startsWith(tier))) continue;
    const path = resolve(root, name);
    const kind = await lstat(path);
    if (kind.isSymbolicLink()) throw new Error(OfflineMessage.Selection);
    if (!FlatTestRule.File.test(name)) continue;
    if (!kind.isFile() || (await realpath(path)) !== path)
      throw new Error(OfflineMessage.Selection);
    if (files.length >= limits.max_files) throw new Error(OfflineMessage.Selection);
    files.push(name);
  }
  return files.sort();
}

export async function selectOfflineTests(
  root: string,
  selected: unknown,
  input: OfflineSelectionLimitsInput = {},
) {
  const limits = OfflineSelectionLimitsSchema.parse(input);
  const selectors = OfflineTestArgumentsSchema.parse(selected);
  if (selectors.length > limits.max_arguments) throw new Error(OfflineMessage.Selection);
  const canonical = await realpath(root);
  const files = await offlineInventory(canonical, limits);
  const result = new Set<string>();
  for (const argument of selectors.length ? selectors : OfflineTestRoots) {
    const name = relative(canonical, resolve(canonical, argument));
    if (
      !TestLayout.TierDirectories.some(
        (tier) => name === tier || name.startsWith(tier + PathPart.Separator),
      )
    )
      throw new Error(OfflineMessage.Selection);
    const matches = files.filter(
      (file) => file === name || file.startsWith(name + PathPart.Separator),
    );
    if (!matches.length) throw new Error(OfflineMessage.Selection);
    for (const file of matches) result.add(HookFile.RelativePrefix + file);
  }
  return [...result];
}
