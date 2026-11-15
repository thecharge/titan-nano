import { expect } from "bun:test";
import { resolve } from "node:path";
import type { WorkspaceSource } from "@titan/types";
import { readWorkspaces } from "../../tooling/scripts/check-boundaries.ts";
import { inspectPackageGraph } from "../../tooling/scripts/package-graph.ts";

function workspace(
  name: string,
  source = "export const value = 1;",
  dependencies: Record<string, string> = {},
): WorkspaceSource {
  return {
    directory: `packages/${name.replace("@titan/", "")}`,
    manifest: { name, dependencies, exports: { ".": "./src/index.ts" } },
    sources: { "src/index.ts": source },
  };
}
export const boundaryActualWorkspace = async () => {
  expect(inspectPackageGraph(await readWorkspaces(resolve(import.meta.dir, "../..")))).toEqual([]);
};
export const boundaryImportViolation = (
  rule: string,
  source: string,
  dependencies: Record<string, string>,
) => {
  const findings = inspectPackageGraph([
    workspace("@titan/core"),
    workspace("@titan/runner", source, dependencies),
  ]);
  expect(findings.some((finding) => finding.rule === rule)).toBe(true);
};
export const boundaryLazyCycle = () => {
  const a = workspace("@titan/a", "", { "@titan/b": "workspace:*" });
  const b = workspace("@titan/b", "", { "@titan/a": "workspace:*" });
  expect(inspectPackageGraph([a, b]).some((finding) => finding.rule === "dependency-cycle")).toBe(
    true,
  );
};
export const boundaryMissingContracts = () => {
  const item = workspace("@titan/a", "", { "@titan/missing": "workspace:*" });
  item.manifest.exports = { ".": "./src/missing.ts" };
  expect(inspectPackageGraph([item]).map((finding) => finding.rule)).toEqual([
    "missing-workspace",
    "missing-export",
  ]);
};
export const boundaryCoreDirection = () => {
  const core = workspace("@titan/core", "", { "@titan/runner": "workspace:*" });
  expect(
    inspectPackageGraph([core, workspace("@titan/runner")]).some(
      (finding) => finding.rule === "core-direction",
    ),
  ).toBe(true);
};
export const boundaryCommandScope = async () => {
  const { checkBoundaries } = await import("../../tooling/scripts/check-boundaries.ts");
  const root = resolve(import.meta.dir, "../..");
  let workspaces = 0;
  for await (const _file of new Bun.Glob("{apps,packages}/*/package.json").scan({ cwd: root }))
    workspaces++;
  const output: unknown[] = [];
  expect(await checkBoundaries(root, (value) => output.push(value))).toBe(0);
  expect(output).toEqual([`Package boundaries: ${workspaces} workspaces, 0 findings`]);
};
