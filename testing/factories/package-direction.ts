import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { readTree, treeHash } from "@titan/workspace";
import { checkBoundaries } from "../../tooling/scripts/check-boundaries.ts";

export async function packageDirectionTree(owner: string, dependency: string) {
  return withTemporaryDirectory(async (root) => {
    await mkdir(resolve(root, "apps"));
    for (const [directory, name, dependencies] of [
      [owner.split("/").at(-1) ?? owner, owner, { [dependency]: "workspace:*" }],
      [dependency.split("/").at(-1) ?? dependency, dependency, {}],
    ] as const) {
      const path = resolve(root, "packages", directory);
      await mkdir(resolve(path, "src"), { recursive: true });
      await writeFile(
        resolve(path, "package.json"),
        Buffer.from(
          JSON.stringify({
            name,
            private: true,
            dependencies,
            exports: { ".": "./src/index.ts" },
          }),
        ),
      );
      await writeFile(resolve(path, "src/index.ts"), Buffer.from("export {};"));
    }
    const before = await treeHash(await readTree(root));
    const findings: string[] = [];
    try {
      const code = await checkBoundaries(
        root,
        () => {},
        (line) => findings.push(line),
      );
      for (const finding of findings) {
        assert.ok(finding.includes(owner), finding);
        assert.ok(finding.includes(dependency), finding);
      }
      return { code, findings: findings.length };
    } finally {
      assert.equal(await treeHash(await readTree(root)), before);
    }
  });
}
