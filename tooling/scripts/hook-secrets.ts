import { join } from "node:path";
import {
  HookCommitMessageCommand,
  HookConfigArgument,
  HookFile,
  HookLimit,
  HookSecretCommand,
} from "@titan/constants";
import { commandStatus } from "./hook-process.ts";

export async function scanSnapshotFiles(
  directory: string,
  files: readonly string[],
): Promise<number> {
  let exitCode = 0;
  for (let offset = 0; offset < files.length; offset += HookLimit.FilesPerScan) {
    const code = await commandStatus(
      [
        ...HookSecretCommand,
        ...files
          .slice(offset, offset + HookLimit.FilesPerScan)
          .map((file) => HookFile.RelativePrefix + file),
      ],
      directory,
    );
    if (code !== 0) exitCode = 1;
  }
  return exitCode;
}

export async function checkCommitMessage(directory: string, message: Buffer): Promise<number> {
  const temporary = await mkdtemp(join(tmpdir(), HookFile.MessageTemporaryPrefix));
  const file = join(temporary, HookFile.Message);
  try {
    await writeFile(file, message, { mode: HookFile.PrivateMode });
    const secrets = await commandStatus(
      [...HookSecretCommand, HookConfigArgument.Secrets, join(directory, HookFile.Secrets), file],
      directory,
    );
    if (secrets !== 0) return secrets;
    return commandStatus(
      [
        ...HookCommitMessageCommand,
        HookConfigArgument.Commits,
        join(directory, HookFile.Commitlint),
      ],
      directory,
      message,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
