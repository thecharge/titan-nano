import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { InventoryReadLimitsInput } from "@titan/types";
import { readTree, treeHash } from "@titan/workspace";
import { readWorkspaces } from "../../tooling/scripts/workspaces.ts";

export async function workspaceInventory(
  sizes: number[],
  limits: InventoryReadLimitsInput = {},
  patterns = ["packages/*"],
  rootPadding = 0,
) {
  return withTemporaryDirectory(async (root) => {
    await mkdir(resolve(root, "packages"));
    await writeFile(
      resolve(root, "package.json"),
      Buffer.from(
        JSON.stringify({
          name: "fixture",
          workspaces: { packages: patterns },
          description: "x".repeat(rootPadding),
        }),
      ),
    );
    for (const [index, size] of sizes.entries()) {
      const directory = resolve(root, "packages", `item-${index}`);
      await mkdir(directory);
      await writeFile(
        resolve(directory, "package.json"),
        Buffer.from(
          JSON.stringify({ name: `@fixture/item-${index}`, description: "x".repeat(size) }),
        ),
      );
    }
    const before = await treeHash(await readTree(root));
    try {
      const rows = await readWorkspaces(root, limits);
      assert.equal(new Set(rows.map((row) => row.manifest.name)).size, rows.length);
      assert.equal(rows[0]?.manifest.name, "fixture");
      return rows.length;
    } finally {
      assert.equal(await treeHash(await readTree(root)), before);
    }
  });
}
