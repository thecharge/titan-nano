import { negative, positive } from "@titan/test-factories";

const one = ["SF:a.ts", "FNF:2", "FNH:1", "DA:1,0", "DA:2,3", "end_of_record"];
const two = ["SF:a.ts", "FNF:2", "FNH:2", "DA:1,4", "DA:2,0", "end_of_record"];
const other = ["SF:b.ts", "FNF:1", "FNH:1", "DA:5,1", "end_of_record"];
export const mergedCoverageCases = {
  positive: [
    positive(
      "line hits add across shards and the best function count stays",
      [[one, two]],
      [{ file: "a.ts", lines: { "1": 4, "2": 3 }, functionsFound: 2, functionsHit: 2 }],
    ),
    positive(
      "files seen in one shard stay",
      [[one, other]],
      [
        { file: "a.ts", lines: { "1": 0, "2": 3 }, functionsFound: 2, functionsHit: 1 },
        { file: "b.ts", lines: { "5": 1 }, functionsFound: 1, functionsHit: 1 },
      ],
    ),
  ],
  negative: [
    negative("a record without its end marker is refused", [[["SF:a.ts", "DA:1,1"]]], {
      message: "Coverage report is malformed or incomplete",
    }),
    negative("an empty shard report is refused", [[[]]], {
      message: "Coverage report is malformed or incomplete",
    }),
  ],
};

export const coverageRoundTripCases = {
  positive: [
    positive("one record survives a round trip", [one], true),
    positive("two records survive a round trip", [[...one, ...other]], true),
  ],
  negative: [
    negative("a broken record cannot round trip", [["SF:a.ts", "DA:1,1"]], {
      message: "Coverage report is malformed or incomplete",
    }),
    negative("an empty report cannot round trip", [[]], {
      message: "Coverage report is malformed or incomplete",
    }),
  ],
};
