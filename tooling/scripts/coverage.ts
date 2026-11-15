import { CoverageRule, InvalidCoverageMessage, LcovTag, TextSymbol } from "@titan/constants";
import { type CoverageGap, type CoverageRecord, CoverageRecordSchema } from "@titan/types";

function count(text: string): number {
  const value = Number(text);
  if (!text || !Number.isSafeInteger(value) || value < 0) throw new Error(InvalidCoverageMessage);
  return value;
}

function applyLine(record: CoverageRecord, line: string): void {
  if (line.startsWith(LcovTag.Line)) {
    const [number, hits] = line.slice(LcovTag.Line.length).split(TextSymbol.Comma);
    if (count(number ?? TextSymbol.Empty) < 1) throw new Error(InvalidCoverageMessage);
    record.lines[number ?? TextSymbol.Empty] = count(hits ?? TextSymbol.Empty);
  }
  if (line.startsWith(LcovTag.FunctionsFound))
    record.functionsFound = count(line.slice(LcovTag.FunctionsFound.length));
  if (line.startsWith(LcovTag.FunctionsHit))
    record.functionsHit = count(line.slice(LcovTag.FunctionsHit.length));
}

export async function parseCoverage(
  lines: Iterable<string> | AsyncIterable<string>,
): Promise<CoverageRecord[]> {
  const records: CoverageRecord[] = [];
  let current: CoverageRecord | undefined;
  for await (const line of lines) {
    if (line.startsWith(LcovTag.Source) && current) throw new Error(InvalidCoverageMessage);
    if (
      line === LcovTag.End &&
      (!current || records.some((record) => record.file === current?.file))
    )
      throw new Error(InvalidCoverageMessage);
    if (line.startsWith(LcovTag.Source)) {
      current = {
        file: line.slice(LcovTag.Source.length),
        lines: {},
        functionsFound: -1,
        functionsHit: -1,
      };
    } else if (line === LcovTag.End) {
      records.push(CoverageRecordSchema.parse(current));
      current = undefined;
    } else if (current) applyLine(current, line);
  }
  if (current || records.length === 0) throw new Error(InvalidCoverageMessage);
  return records;
}

export function coverageGaps(
  expected: readonly string[],
  records: readonly CoverageRecord[],
): CoverageGap[] {
  const loaded = new Map(records.map((record) => [record.file, record]));
  return expected.flatMap((file) => {
    const record = loaded.get(file);
    if (!record) return [{ file, rule: CoverageRule.Missing, lines: [], missingFunctions: 0 }];
    const gaps: CoverageGap[] = [];
    const lines = Object.entries(record.lines)
      .filter(([, hits]) => hits === 0)
      .map(([line]) => Number(line));
    if (lines.length) gaps.push({ file, rule: CoverageRule.Lines, lines, missingFunctions: 0 });
    const missingFunctions = record.functionsFound - record.functionsHit;
    if (missingFunctions > 0)
      gaps.push({ file, rule: CoverageRule.Functions, lines: [], missingFunctions });
    return gaps;
  });
}
