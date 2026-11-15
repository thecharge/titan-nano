import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { BoundaryReadLimitsInput } from "@titan/types";
import { readTree, treeHash } from "@titan/workspace";
import { readWorkspaces } from "../../tooling/scripts/check-boundaries.ts";

export async function boundaryBudget(
  sources: string[],
  limits: BoundaryReadLimitsInput = {},
  packages = 1,
  document?: string,
  extension = "ts",
) {
  return withTemporaryDirectory(async (root) => {
    await mkdir(resolve(root, "apps"));
    await mkdir(resolve(root, "packages"));
    for (let index = 0; index < packages; index++) {
      const directory = resolve(root, "packages", `package-${index}`);
      await mkdir(resolve(directory, "src"), { recursive: true });
      await writeFile(
        resolve(directory, "package.json"),
        Buffer.from(
          document ??
            JSON.stringify({
              name: `@fixture/package-${index}`,
              exports: { ".": `./src/index.${extension}` },
            }),
        ),
      );
      for (const [number, source] of sources.entries())
        await writeFile(
          resolve(
            directory,
            "src",
            number ? `source-${number}.${extension}` : `index.${extension}`,
          ),
          Buffer.from(source),
        );
    }
    const before = await treeHash(await readTree(root));
    try {
      const rows = await readWorkspaces(root, limits);
      assert.equal(
        rows.flatMap((row) => Object.values(row.sources)).length,
        packages * sources.length,
      );
      return rows.length;
    } finally {
      assert.equal(await treeHash(await readTree(root)), before);
    }
  });
}
