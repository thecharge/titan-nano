import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkCatalogDecisions } from "../../tooling/scripts/check-catalog-decisions.ts";

const root = resolve(import.meta.dir, "../..");
const designFile = "openspec/changes/resilient-agent-blackboard-bun/design.md";

export async function catalogDecisions(catalog: Record<string, string>, design: string) {
  return withTemporaryDirectory(async (directory) => {
    await mkdir(join(directory, "openspec/changes/resilient-agent-blackboard-bun"), {
      recursive: true,
    });
    await writeFile(join(directory, designFile), design);
    await writeFile(join(directory, "package.json"), JSON.stringify({ workspaces: { catalog } }));
    return checkCatalogDecisions(directory);
  });
}

export async function repositoryCatalogDecisions() {
  return checkCatalogDecisions(root);
}
