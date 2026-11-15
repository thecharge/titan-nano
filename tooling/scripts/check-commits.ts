import { resolve } from "node:path";
import { HookCommitMessageCommand, HookConfigArgument, HookFile } from "@titan/constants";
import { commitSubjectFailed } from "@titan/messages";
import { commandStatus } from "./hook-process.ts";

const root = resolve(import.meta.dir, HookFile.RepositoryRoot);
let exitCode = 0;
for (const subject of process.argv.slice(2)) {
  const code = await commandStatus(
    [...HookCommitMessageCommand, HookConfigArgument.Commits, resolve(root, HookFile.Commitlint)],
    root,
    Buffer.from(subject),
  );
  if (code !== 0) {
    console.error(commitSubjectFailed(subject));
    exitCode = 1;
  }
}
process.exitCode = exitCode;
