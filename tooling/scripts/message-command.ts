import { createReadStream } from "node:fs";
import { HookLimit } from "@titan/constants";
import { HookMessage } from "@titan/messages";
import { checkHookPolicy } from "./hook-policy.ts";
import { reportHookFailure } from "./hook-process.ts";
import { checkCommitMessage } from "./hook-secrets.ts";

async function readMessage(source: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of source) {
    size += chunk.byteLength;
    if (size > HookLimit.OutputBytes) throw new Error(HookMessage.OutputLimit);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, size);
}

export async function readCommitMessage(path: string): Promise<Buffer> {
  const input = createReadStream(path);
  try {
    return await readMessage(input);
  } finally {
    input.destroy();
  }
}

export async function runMessageCheck(directory: string, file?: string): Promise<number> {
  try {
    await checkHookPolicy(directory);
    if (!file) throw new Error(HookMessage.InvalidPolicy);
    return await checkCommitMessage(directory, await readCommitMessage(file));
  } catch (error) {
    return reportHookFailure(error);
  }
}
