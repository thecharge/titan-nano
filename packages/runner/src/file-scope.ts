import { PathPart } from "@titan/constants";
import type { FileMap, Run, SecretScannerFactory, Step } from "@titan/types";

import { readTree, readWorkspaceSnapshot } from "@titan/workspace";

export function scopeCovers(entry: string, path: string): boolean {
  return (
    entry === PathPart.Current || path === entry || path.startsWith(entry + PathPart.Separator)
  );
}

export function writePaths(run: Run, step: Step): string[] {
  if (!step.files) return [PathPart.Current];
  return [...step.files, ...(run.nodes[step.id]?.write_paths ?? [])];
}

export function readRunSnapshot(
  run: Run,
  root: string,
  scanner?: SecretScannerFactory,
): Promise<FileMap> {
  const limits = run.config.value.limits;
  if (!run.omit_generated_workspace) return readTree(root, limits, scanner, run.runtime_paths);
  const included = run.plan.nodes.flatMap((step) => [
    ...(step.files ?? []),
    ...(run.nodes[step.id]?.write_paths ?? []),
  ]);
  return readWorkspaceSnapshot(root, limits, scanner, run.runtime_paths, included);
}
