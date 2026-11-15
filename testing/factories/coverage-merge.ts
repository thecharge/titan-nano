import { all } from "@titan/core";
import { parseCoverage } from "../../tooling/scripts/coverage.ts";
import { formatCoverage, mergeCoverage } from "../../tooling/scripts/coverage-merge.ts";

export async function mergedCoverage(parts: string[][]): Promise<unknown> {
  const parsed = await all(parts.map((part) => async () => parseCoverage(part)));
  return mergeCoverage(parsed);
}

export async function coverageRoundTrip(lines: string[]): Promise<boolean> {
  const first = await parseCoverage(lines);
  const text = formatCoverage(first);
  return JSON.stringify(await parseCoverage(text.split("\n"))) === JSON.stringify(first);
}
