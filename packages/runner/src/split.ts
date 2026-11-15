import { DataKind, TextSymbol } from "@titan/constants";
import { all } from "@titan/core";
import type { Run, Step } from "@titan/types";

export function splitWidth(step: Step, maxParallel: number): number {
  return Math.min(step.split?.width ?? maxParallel, maxParallel);
}

export function runParts(
  items: readonly unknown[],
  width: number,
  part: (item: unknown, index: number) => Promise<unknown>,
): Promise<unknown[]> {
  return all(
    items.map((item, index) => () => part(item, index)),
    width,
  );
}

export function referenceValue(run: Run, reference: string): unknown {
  const [producer, ...path] = reference.split(TextSymbol.Dot);
  let value: unknown = producer ? run.nodes[producer]?.output : undefined;
  for (const field of path)
    value =
      value && typeof value === DataKind.Object
        ? (value as Record<string, unknown>)[field]
        : undefined;
  return value;
}
