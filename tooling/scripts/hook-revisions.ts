import {
  GitHookArgument,
  GitHookFormat,
  GitZeroPattern,
  HookCommand,
  HookLimit,
} from "@titan/constants";
import { HookMessage } from "@titan/messages";
import { GitObjectSchema, type GitPushUpdate, GitPushUpdateSchema } from "@titan/types";
import { commandOutput } from "./hook-process.ts";

export async function parsePushUpdates(input: string): Promise<GitPushUpdate[]> {
  const lines = input.split(GitHookFormat.Newline).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    const fields = line.trim().split(GitHookFormat.FieldSeparator);
    if (fields.length !== 4) throw new Error(HookMessage.InvalidPush);
    return GitPushUpdateSchema.parse({
      localRef: fields[0],
      localObject: fields[1],
      remoteRef: fields[2],
      remoteObject: fields[3],
    });
  });
}

export function isOutgoingTip(commits: readonly string[], commit: string): boolean {
  return commits.at(-1) === commit;
}

export async function outgoingCommits(root: string, update: GitPushUpdate): Promise<string[]> {
  if (GitZeroPattern.test(update.localObject)) return [];
  const local = GitObjectSchema.parse(update.localObject);
  const command: string[] = [HookCommand.Git, ...GitHookArgument.RevisionList];
  if (GitZeroPattern.test(update.remoteObject)) command.push(local);
  else {
    const remote = GitObjectSchema.parse(update.remoteObject);
    try {
      await commandOutput(
        [HookCommand.Git, ...GitHookArgument.Verify, remote + GitHookArgument.CommitSuffix],
        { cwd: root },
      );
    } catch {
      throw new Error(HookMessage.MissingRemote);
    }
    command.push(remote + GitHookArgument.Range + local);
  }
  const output = await commandOutput(command, { cwd: root });
  const commits = output
    .split(GitHookFormat.Newline)
    .filter(Boolean)
    .map((id) => GitObjectSchema.parse(id));
  if (commits.length > HookLimit.CommitCount) throw new Error(HookMessage.TooManyCommits);
  return commits;
}
