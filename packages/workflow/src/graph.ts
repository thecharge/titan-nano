import { ErrorCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { dependencyCycle, missingDependency } from "@titan/messages";
import type { Step, Workflow } from "@titan/types";
import { validateInputs, validatePersonas } from "./formats.ts";

function indexNodes(input: Step[]): Map<string, Step> {
  const nodes = new Map<string, Step>();
  for (const node of input) nodes.set(node.id, node);
  return nodes;
}

function visit(
  key: string,
  path: string[],
  nodes: Map<string, Step>,
  ancestors: Map<string, Set<string>>,
): Set<string> {
  if (path.includes(key))
    throw new TitanError(ErrorCode.DependencyCycle, dependencyCycle([...path, key]));
  const cached = ancestors.get(key);
  if (cached) return cached;
  const node = nodes.get(key);
  if (!node) throw new TitanError(ErrorCode.MissingDependency, missingDependency(key));
  const result = new Set<string>();
  for (const parent of node.needs ?? []) {
    result.add(parent);
    for (const ancestor of visit(parent, [...path, key], nodes, ancestors)) result.add(ancestor);
  }
  ancestors.set(key, result);
  return result;
}

export function validateDependencies(input: Step[], workflow: Workflow): void {
  const nodes = indexNodes(input);
  const ancestors = new Map<string, Set<string>>();
  for (const node of nodes.values()) {
    const parents = visit(node.id, [], nodes, ancestors);
    validateInputs(node, parents, nodes, workflow);
    validatePersonas(node, workflow);
  }
}
