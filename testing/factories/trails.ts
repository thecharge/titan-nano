import { fadeTrails } from "../../packages/policy/src/index.ts";

const Precision = 1e6;

export function fadedTrails(trails: Record<string, number>) {
  const before = structuredClone(trails);
  const faded = fadeTrails(trails);
  if (JSON.stringify(before) !== JSON.stringify(trails)) {
    throw new Error(JSON.stringify(trails));
  }
  return Object.fromEntries(
    Object.entries(faded).map(([choice, count]) => [
      choice,
      Math.round(count * Precision) / Precision,
    ]),
  );
}
