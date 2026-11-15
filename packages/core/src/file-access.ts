import { FileAccessMode, PathPart } from "@titan/constants";
import type { FileAccessScope } from "@titan/types";

export function filePathCovers(parent: string, path: string): boolean {
  return (
    parent === path ||
    path.startsWith(parent.endsWith(PathPart.Separator) ? parent : parent + PathPart.Separator)
  );
}

function intersects(left: readonly string[], right: readonly string[]): boolean {
  return left.some((a) => right.some((b) => filePathCovers(a, b) || filePathCovers(b, a)));
}

export function fileScopesOverlap(left: FileAccessScope, right: FileAccessScope): boolean {
  const leftWrites = left.mode === FileAccessMode.Write ? left.paths : [];
  const rightWrites = right.mode === FileAccessMode.Write ? right.paths : [];
  return (
    intersects(leftWrites, [...right.paths, ...(right.read_paths ?? [])]) ||
    intersects(rightWrites, [...left.paths, ...(left.read_paths ?? [])])
  );
}
