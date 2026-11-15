import { object } from "@titan/config";
import { DataKind, ErrorCode, GroupField } from "@titan/constants";
import { TitanError } from "@titan/errors";
import {
  duplicateStep,
  groupDependencies,
  nestedPath,
  stepPath,
  WorkflowMessage,
} from "@titan/messages";
import type { Group, Step } from "@titan/types";
import { z } from "zod";

export function assertGroupDepth(value: unknown, maxDepth: number, level = 0): void {
  if (level > maxDepth) throw new TitanError(ErrorCode.GroupDepth, WorkflowMessage.GroupDepth);
  if (Array.isArray(value)) {
    for (const child of value) assertGroupDepth(child, maxDepth, level);
    return;
  }
  if (!value || typeof value !== DataKind.Object) return;
  const item = object(value);
  if (item[GroupField.Sequential])
    assertGroupDepth(item[GroupField.Sequential], maxDepth, level + 1);
  if (item[GroupField.Parallel]) assertGroupDepth(item[GroupField.Parallel], maxDepth, level + 1);
}

export function compileGroups(
  items: Group[],
  parallel: boolean,
  previous: string[],
  nodes: Step[],
): string[] {
  let before = previous;
  const ends: string[] = [];
  for (const item of items) {
    const after = compileItem(item, before, nodes);
    if (!parallel) before = after;
    ends.push(...after);
  }
  return parallel ? ends : before;
}

function compileItem(item: Group, before: string[], nodes: Step[]): string[] {
  if (GroupField.Sequential in item) return compileGroups(item.sequential, false, before, nodes);
  if (GroupField.Parallel in item) return compileGroups(item.parallel, true, before, nodes);
  if (item.needs) throw new TitanError(ErrorCode.AmbiguousDependencies, groupDependencies(item.id));
  nodes.push({ ...item, needs: [...before] });
  return [item.id];
}

export function stepLocations(
  items: unknown[],
  prefix: string,
  found: Map<string, string> = new Map(),
): Map<string, string> {
  items.forEach((value, index) => {
    const item = object(value);
    const path = stepPath(prefix, index);
    const id = z.string().safeParse(item[GroupField.Id]).data;
    if (id !== undefined) {
      const first = found.get(id);
      if (first) throw new TitanError(ErrorCode.DuplicateStep, duplicateStep(id, first, path));
      found.set(id, path);
    }
    for (const field of [GroupField.Sequential, GroupField.Parallel])
      if (Array.isArray(item[field])) stepLocations(item[field], nestedPath(path, field), found);
  });
  return found;
}
