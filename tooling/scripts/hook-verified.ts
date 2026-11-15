import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { HookFile } from "@titan/constants";
import { GitObjectSchema } from "@titan/types";

export async function treeVerified(root: string, tree: string): Promise<boolean> {
  return Bun.file(join(root, HookFile.Verified, GitObjectSchema.parse(tree))).exists();
}

export async function markTreeVerified(root: string, tree: string): Promise<void> {
  const name = GitObjectSchema.parse(tree);
  await mkdir(join(root, HookFile.Verified), { recursive: true });
  await Bun.write(join(root, HookFile.Verified, name), name);
}
