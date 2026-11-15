import { PathPart } from "@titan/constants";
import type { Run, Step } from "@titan/types";

export function scopeCovers(entry: string, path: string): boolean {
  return (
    entry === PathPart.Current || path === entry || path.startsWith(entry + PathPart.Separator)
  );
}

export function writePaths(run: Run, step: Step): string[] {
  if (!step.files) return [PathPart.Current];
  return [...step.files, ...(run.nodes[step.id]?.write_paths ?? [])];
}
