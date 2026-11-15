import { CoverageRule, TypeScriptPolicy } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const covered = { file: "source.ts", functionsFound: 1, functionsHit: 1, lines: { "1": 1 } };
const uncovered = { file: "source.ts", functionsFound: 1, functionsHit: 0, lines: { "1": 0 } };
const empty = { file: "source.ts", functionsFound: 0, functionsHit: 0, lines: {} };
export const coverageParseCases = {
  positive: [
    positive(
      "covered function and line",
      [["SF:source.ts", "FNF:1", "FNH:1", "DA:1,1", "end_of_record"]],
      [covered],
    ),
    positive(
      "uncovered entries are retained",
      [["SF:source.ts", "FNF:1", "FNH:0", "DA:1,0", "end_of_record"]],
      [uncovered],
    ),
  ],
  negative: [
    negative(
      "source record cannot replace an unfinished record",
      [["SF:first.ts", "SF:second.ts", "FNF:0", "FNH:0", "end_of_record"]],
      {
        message: "Coverage report is malformed or incomplete",
      },
    ),
    negative("end marker requires a source record", [["end_of_record"]], {
      message: "Coverage report is malformed or incomplete",
    }),
    negative("truncated record", [["SF:source.ts", "FNF:1", "FNH:1"]], {
      message: "Coverage report is malformed or incomplete",
    }),
    negative(
      "invalid hit count",
      [["SF:source.ts", "FNF:1", "FNH:1", "DA:1,NaN", "end_of_record"]],
      { message: "Coverage report is malformed or incomplete" },
    ),
    negative(
      "duplicate source record",
      [
        [
          "SF:source.ts",
          "FNF:0",
          "FNH:0",
          "end_of_record",
          "SF:source.ts",
          "FNF:0",
          "FNH:0",
          "end_of_record",
        ],
      ],
      { message: "Coverage report is malformed or incomplete" },
    ),
  ],
};
export const coverageGapCases = {
  positive: [
    positive("fully covered source", [["source.ts"], [covered]], []),
    positive("declaration with no runtime functions", [["source.ts"], [empty]], []),
  ],
  negative: [
    rejected(
      "unloaded source fails independently of aggregate coverage",
      [["source.ts"], []],
      [{ file: "source.ts", rule: CoverageRule.Missing, lines: [], missingFunctions: 0 }],
    ),
    rejected(
      "an uncovered line and function fail",
      [["source.ts"], [uncovered]],
      [
        { file: "source.ts", rule: CoverageRule.Lines, lines: [1], missingFunctions: 0 },
        { file: "source.ts", rule: CoverageRule.Functions, lines: [], missingFunctions: 1 },
      ],
    ),
  ],
};

export const coverageSourceScopeCases = {
  positive: TypeScriptPolicy.SourceExtensions.map((extension) =>
    positive(`covered ${extension} source is counted`, [extension, true, 1], 0),
  ),
  negative: TypeScriptPolicy.SourceExtensions.flatMap((extension) => [
    rejected(`missing ${extension} record fails coverage`, [extension, false, 1], 1),
    rejected(`uncovered ${extension} source fails coverage`, [extension, true, 0], 1),
  ]),
};
