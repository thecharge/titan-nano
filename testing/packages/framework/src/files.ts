import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DirectoryAction } from "@titan/types";

export async function withTemporaryDirectory<T>(action: DirectoryAction<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "titan-test-"));
  try {
    return await action(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
