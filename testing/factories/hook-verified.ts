import { join } from "node:path";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { markTreeVerified, treeVerified } from "../../tooling/scripts/hook-verified.ts";

export async function verifiedTree(mark: string | null, ask: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    if (mark !== null) await markTreeVerified(root, mark);
    return treeVerified(join(root), ask);
  });
}
