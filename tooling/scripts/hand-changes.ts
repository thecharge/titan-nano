import { join } from "node:path";
import { GitHookFormat, HandChange, HookCommand } from "@titan/constants";
import { HookMessage, handChangesMissing } from "@titan/messages";
import { RunWrittenFilesSchema } from "@titan/types";
import { commandOutput, reportHookFailure } from "./hook-process.ts";
import { readCommitMessage, runMessageCheck } from "./message-command.ts";

function listedByHand(message: string): Set<string> {
  const listed = new Set<string>();
  for (const line of message
    .replace(HandChange.WrappedPrefix, HandChange.Prefix)
    .split(GitHookFormat.Newline)) {
    if (!line.startsWith(HandChange.Prefix)) continue;
    for (const file of line.slice(HandChange.Prefix.length).split(HandChange.Separator))
      listed.add(file);
  }
  return listed;
}

function missingHandChanges(
  message: string,
  staged: readonly string[],
  written: readonly string[],
): string[] {
  const listed = listedByHand(message);
  const byRuns = new Set(written);
  return staged.filter((file) => !byRuns.has(file) && !listed.has(file));
}

async function stagedFiles(directory: string): Promise<string[]> {
  const output = await commandOutput([HookCommand.Git, ...HandChange.Staged], {
    cwd: directory,
    raw: true,
  });
  return output.split(GitHookFormat.Null).filter((file) => file.length > 0);
}

async function runWrittenFiles(directory: string): Promise<string[]> {
  const record = Bun.file(join(directory, HandChange.RunRecord));
  if (!(await record.exists())) return [];
  return RunWrittenFilesSchema.parse(await record.json());
}

export async function runHandChangeCheck(directory: string, file?: string): Promise<number> {
  try {
    if (!file) throw new Error(HookMessage.InvalidPolicy);
    const message = (await readCommitMessage(file)).toString();
    const missing = missingHandChanges(
      message,
      await stagedFiles(directory),
      await runWrittenFiles(directory),
    );
    if (missing.length === 0) return 0;
    console.error(HookMessage.HandChanges);
    console.error(handChangesMissing(missing));
    return 1;
  } catch (error) {
    return reportHookFailure(error);
  }
}

export async function runMessagePolicy(directory: string, file?: string): Promise<number> {
  const code = await runMessageCheck(directory, file);
  return code === 0 ? runHandChangeCheck(directory, file) : code;
}
