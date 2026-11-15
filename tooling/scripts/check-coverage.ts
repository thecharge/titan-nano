import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { CoverageFile, ProductSourceGlob } from "@titan/constants";
import { coverageGaps, parseCoverage } from "./coverage.ts";

const input = createReadStream(CoverageFile);
const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
try {
  const records = await parseCoverage(lines);
  const sources = await Array.fromAsync(new Bun.Glob(ProductSourceGlob).scan());
  const gaps = coverageGaps(sources, records);
  for (const gap of gaps) console.error(JSON.stringify(gap));
  console.log(JSON.stringify({ sources: sources.length, gaps: gaps.length }));
  process.exitCode = gaps.length ? 1 : 0;
} finally {
  lines.close();
  input.destroy();
}
