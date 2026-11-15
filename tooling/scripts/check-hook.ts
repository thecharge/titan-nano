import { resolve } from "node:path";
import {
  GitHookArgument,
  GitHookFormat,
  GitZeroPattern,
  HookCommand,
  HookFile,
  HookGitInputLimit,
  HookLimit,
  HookMode,
} from "@titan/constants";
import { HookMessage } from "@titan/messages";
import { GitObjectSchema, type GitPushUpdate, HookRequestSchema } from "@titan/types";
import { checkHookSnapshot } from "./hook-checks.ts";
import { linkOutgoingDependencies } from "./hook-dependencies.ts";
import { checkHookPolicy } from "./hook-policy.ts";
import { commandOutput, reportHookFailure } from "./hook-process.ts";
import { isOutgoingTip, outgoingCommits, parsePushUpdates } from "./hook-revisions.ts";
import { readHookChanges } from "./hook-scope.ts";
import { checkCommitMessage, scanSnapshotFiles } from "./hook-secrets.ts";
import { withGitSnapshot } from "./hook-snapshot.ts";
import { markTreeVerified, treeVerified } from "./hook-verified.ts";

async function readInput(): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of Bun.stdin.stream()) {
    size += chunk.byteLength;
    if (size > HookGitInputLimit) throw new Error(HookMessage.OutputLimit);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, size).toString();
}

async function checkTree(
  root: string,
  object: string,
  message?: Buffer,
  base: string | null = null,
  tip = true,
): Promise<number> {
  const tree = GitObjectSchema.parse(
    await commandOutput(
      [HookCommand.Git, ...GitHookArgument.Verify, object + GitHookArgument.TreeSuffix],
      { cwd: root },
    ),
  );
  console.log(HookMessage.Snapshot, tree);
  const inventory = await commandOutput([HookCommand.Git, ...GitHookArgument.Files, tree], {
    cwd: root,
    raw: true,
  });
  const files = inventory.split(GitHookFormat.Null).filter(Boolean);
  const changes = await readHookChanges(root, tree, base);
  return withGitSnapshot(root, tree, async (snapshot) => {
    await linkOutgoingDependencies(root, snapshot, tip);
    if (tip) await checkHookPolicy(snapshot);
    const metadata = message ? await checkCommitMessage(snapshot, message) : 0;
    if (!tip) return (await scanSnapshotFiles(snapshot, files)) || metadata;
    if (await treeVerified(root, tree)) {
      console.log(HookMessage.AlreadyVerified);
      return metadata;
    }
    const checks = await checkHookSnapshot(snapshot, files, undefined, undefined, changes);
    if (checks === 0) await markTreeVerified(root, tree);
    return checks || metadata;
  });
}

export async function checkHook(mode: HookMode, root: string, input?: string): Promise<number> {
  if (mode === HookMode.Commit) {
    const tree = await commandOutput([HookCommand.Git, ...GitHookArgument.IndexTree], {
      cwd: root,
    });
    return checkTree(root, tree, undefined, GitHookArgument.Head);
  }
  const updates = await parsePushUpdates(input ?? (await readInput()));
  const checked = new Set<string>();
  let exitCode = 0;
  const checkUpdate = async (update: GitPushUpdate): Promise<void> => {
    const commits = await outgoingCommits(root, update);
    for (const commit of commits) {
      if (checked.has(commit)) continue;
      checked.add(commit);
      if (checked.size > HookLimit.CommitCount) throw new Error(HookMessage.TooManyCommits);
      const message = await commandOutput([HookCommand.Git, ...GitHookArgument.Message, commit], {
        cwd: root,
        raw: true,
      });
      const base = GitZeroPattern.test(update.remoteObject)
        ? null
        : commit + GitHookArgument.ParentSuffix;
      const tip = isOutgoingTip(commits, commit);
      if ((await checkTree(root, commit, Buffer.from(message), base, tip)) !== 0) exitCode = 1;
    }
  };
  for (const update of updates) await checkUpdate(update);
  return exitCode;
}

if (import.meta.main) {
  try {
    const request = HookRequestSchema.parse({ mode: process.argv[2] });
    process.exitCode = await checkHook(
      request.mode,
      resolve(import.meta.dir, HookFile.RepositoryRoot),
    );
  } catch (error) {
    process.exitCode = await reportHookFailure(error);
  }
}
