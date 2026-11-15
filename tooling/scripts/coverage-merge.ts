import { LcovTag, TextSymbol } from "@titan/constants";
import type { CoverageRecord } from "@titan/types";

export function mergeCoverage(parts: readonly (readonly CoverageRecord[])[]): CoverageRecord[] {
  const merged = new Map<string, CoverageRecord>();
  for (const part of parts) {
    for (const record of part) {
      const known = merged.get(record.file);
      if (!known) {
        merged.set(record.file, { ...record, lines: { ...record.lines } });
        continue;
      }
      for (const [line, hits] of Object.entries(record.lines))
        known.lines[line] = (known.lines[line] ?? 0) + hits;
      known.functionsFound = Math.max(known.functionsFound, record.functionsFound);
      known.functionsHit = Math.max(known.functionsHit, record.functionsHit);
    }
  }
  return [...merged.values()];
}

export function formatCoverage(records: readonly CoverageRecord[]): string {
  return records
    .flatMap((record) => [
      LcovTag.Source + record.file,
      LcovTag.FunctionsFound + record.functionsFound,
      LcovTag.FunctionsHit + record.functionsHit,
      ...Object.entries(record.lines).map(
        ([line, hits]) => LcovTag.Line + line + TextSymbol.Comma + hits,
      ),
      LcovTag.End,
    ])
    .join(TextSymbol.Newline)
    .concat(TextSymbol.Newline);
}
