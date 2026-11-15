import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import {
  GitHookArgument,
  GitHookFormat,
  HookCommand,
  HookEnvironment,
  HookFile,
} from "@titan/constants";
import { HookMessage } from "@titan/messages";
import { GitObjectSchema, type SnapshotAction } from "@titan/types";
import { cleanGitEnvironment, commandOutput } from "./hook-process.ts";

export async function withGitSnapshot<T>(
  root: string,
  tree: string,
  action: SnapshotAction<T>,
): Promise<T> {
  const object = GitObjectSchema.parse(tree);
  const temporary = await mkdtemp(join(tmpdir(), HookFile.TemporaryPrefix));
  const directory = join(temporary, HookFile.Snapshot);
  const environment = {
    ...(await cleanGitEnvironment()),
    [HookEnvironment.Index]: join(temporary, HookFile.Index),
  };
  try {
    await mkdir(directory);
    const entries = await commandOutput([HookCommand.Git, ...GitHookArgument.Inventory, object], {
      cwd: root,
      environment,
    });
    if (GitHookFormat.TreeMode.test(entries)) throw new Error(HookMessage.UnsafeSnapshot);
    await commandOutput([HookCommand.Git, GitHookArgument.ReadTree, object], {
      cwd: root,
      environment,
    });
    await commandOutput(
      [HookCommand.Git, ...GitHookArgument.ExportIndex, GitHookArgument.Prefix + directory + sep],
      { cwd: root, environment },
    );
    return await action(directory);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
