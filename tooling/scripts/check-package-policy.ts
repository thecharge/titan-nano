import { join, resolve } from "node:path";
import {
  BoundaryRule,
  HookFile,
  HookToolchain,
  PackageArchitecture,
  PackageLayer,
} from "@titan/constants";
import { boundaryFinding, packagePolicySummary } from "@titan/messages";
import {
  type HookWorkspace,
  type InventoryReadLimitsInput,
  PackageArchitectureRootSchema,
} from "@titan/types";
import { dependencyDirection, validPackageIdentity } from "./package-direction.ts";
import { readWorkspaces } from "./workspaces.ts";

function layer(directory: string): PackageLayer {
  return directory === PackageArchitecture.TestDirectory ||
    directory.startsWith(PackageArchitecture.TestDirectoryPrefix)
    ? PackageLayer.Test
    : PackageLayer.Product;
}

function findingsFor(workspace: HookWorkspace, names: Set<string>): string[] {
  const findings: string[] = [];
  const { manifest, directory } = workspace;
  const file = join(directory, HookFile.Manifest);
  if (!validPackageIdentity(directory, manifest.name))
    findings.push(
      boundaryFinding(manifest.name, file, BoundaryRule.PackageIdentity, manifest.name),
    );
  const entries = [manifest.dependencies, manifest.devDependencies].flatMap(Object.entries);
  for (const [name, version] of entries) {
    const direction = dependencyDirection(manifest.name, name, layer(directory));
    if (direction) findings.push(boundaryFinding(manifest.name, file, direction, name));
    if (version.startsWith(HookToolchain.Workspace) && !names.has(name))
      findings.push(boundaryFinding(manifest.name, file, BoundaryRule.MissingWorkspace, name));
  }
  return findings;
}

export async function checkPackagePolicy(
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
  output = console.log,
  report = console.error,
  input: InventoryReadLimitsInput = {},
): Promise<number> {
  const workspaces = await readWorkspaces(root, input);
  PackageArchitectureRootSchema.parse(workspaces[0]?.manifest);
  const names = new Set(workspaces.map((workspace) => workspace.manifest.name));
  let findings = 0;
  for (const workspace of workspaces) {
    for (const finding of findingsFor(workspace, names)) {
      report(finding);
      findings++;
    }
  }
  output(packagePolicySummary(workspaces.length, findings));
  return findings ? 1 : 0;
}

if (import.meta.main) process.exitCode = await checkPackagePolicy();
