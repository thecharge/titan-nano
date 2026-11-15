import { opendir } from "node:fs/promises";
import { resolve } from "node:path";
import { Development, ErrorCode, FileEncoding, HookFile, PathPart } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { boundaryFinding, boundarySummary, VerificationMessage } from "@titan/messages";
import {
  type BoundaryReadLimitsInput,
  BoundaryReadLimitsSchema,
  WorkspaceManifestSchema,
  type WorkspaceSource,
} from "@titan/types";
import { readInventoryBytes } from "./inventory-bytes.ts";
import { inspectPackageGraph } from "./package-graph.ts";

export async function readWorkspaces(
  root: string,
  input: BoundaryReadLimitsInput = {},
): Promise<WorkspaceSource[]> {
  const limits = BoundaryReadLimitsSchema.parse(input);
  const workspaces: WorkspaceSource[] = [];
  let total = 0;
  let count = 0;
  const readSources = async (directory: string): Promise<Record<string, string>> => {
    const sources: Record<string, string> = {};
    const glob = new Bun.Glob(Development.SourceGlob);
    for await (const file of glob.scan({ cwd: resolve(root, directory) })) {
      if (count >= limits.max_sources)
        throw new TitanError(ErrorCode.VerificationBudget, VerificationMessage.BoundaryBudget);
      const bytes = await readInventoryBytes(
        resolve(root, directory, file),
        limits.source_bytes,
        limits.total_bytes - total,
      );
      total += bytes.length;
      count++;
      sources[file] = bytes.toString(FileEncoding.Utf8);
    }
    return sources;
  };
  const readParent = async (parent: string): Promise<void> => {
    for await (const entry of await opendir(resolve(root, parent))) {
      if (!entry.isDirectory()) continue;
      if (workspaces.length >= limits.max_workspaces)
        throw new TitanError(ErrorCode.VerificationBudget, VerificationMessage.BoundaryBudget);
      const directory = [parent, entry.name].join(PathPart.Separator);
      const document = await readInventoryBytes(
        resolve(root, directory, HookFile.Manifest),
        limits.manifest_bytes,
        limits.total_bytes - total,
      );
      total += document.length;
      const manifest = WorkspaceManifestSchema.parse(
        JSON.parse(document.toString(FileEncoding.Utf8)),
      );
      workspaces.push({ directory, manifest, sources: await readSources(directory) });
    }
  };
  for (const parent of [Development.Apps, Development.Packages]) await readParent(parent);
  return workspaces;
}
export async function checkBoundaries(
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
  output = console.log,
  error = console.error,
): Promise<number> {
  const workspaces = await readWorkspaces(root);
  const findings = inspectPackageGraph(workspaces);
  for (const finding of findings)
    error(boundaryFinding(finding.package, finding.file, finding.rule, finding.detail));
  output(boundarySummary(workspaces.length, findings.length));
  return findings.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = await checkBoundaries();
