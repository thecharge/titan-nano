import { strict as assert } from "node:assert";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { HookFile, PackageArchitecture, PathPart, TitanPackage } from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { InventoryReadLimitsInput } from "@titan/types";
import { readTree, treeHash } from "@titan/workspace";
import { checkPackagePolicy } from "../../tooling/scripts/check-package-policy.ts";

async function writeDocument(root: string, path: string, value: unknown) {
  const file = resolve(root, path);
  if (value === null) {
    await unlink(file);
    return;
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(JSON.stringify(value)));
}

async function prepare(root: string) {
  for (const [name, directory] of Object.entries(PackageArchitecture.NamedWorkspaces)) {
    const document: Record<string, unknown> = { name, private: true };
    if (directory === PathPart.Current)
      document.workspaces = { packages: [...PackageArchitecture.WorkspacePatterns] };
    await writeDocument(root, join(directory, HookFile.Manifest), document);
  }
  for (const name of [
    ...PackageArchitecture.Foundation,
    TitanPackage.Core,
    TitanPackage.Codex,
    TitanPackage.Claude,
    "@titan/runner",
    "@titan/workflow",
  ])
    await writeDocument(root, `packages/${name.split("/").at(-1)}/package.json`, {
      name,
      private: true,
    });
}

export async function packagePolicyTree(
  files: Record<string, unknown>,
  expected?: string,
  limits: InventoryReadLimitsInput = {},
) {
  return withTemporaryDirectory(async (root) => {
    await prepare(root);
    for (const [file, value] of Object.entries(files)) await writeDocument(root, file, value);
    const before = await treeHash(await readTree(root));
    const findings: string[] = [];
    try {
      const code = await checkPackagePolicy(
        root,
        () => {},
        (finding) => findings.push(finding),
        limits,
      );
      for (const finding of findings) assert.ok(expected && finding.includes(expected), finding);
      return { code, findings: findings.length };
    } finally {
      assert.equal(await treeHash(await readTree(root)), before);
    }
  });
}
