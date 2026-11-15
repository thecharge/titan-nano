import { negative, positive, rejected } from "@titan/test-factories";

export const listedRunsCases = {
  positive: [
    positive(
      "older pages retain their descending cursor",
      [5, 5, false, false, 4, 2],
      "2 2 2 2 0 true",
    ),
    positive(
      "the last page reports no further history",
      [5, 5, false, false, 3, 2],
      "2 2 2 2 0 true",
    ),
    positive(
      "200 stored summaries need no resident snapshots",
      [200, 50, false, true],
      "200 50 50 50 0 true",
    ),
    positive("stored script stages retain null personas", [4, 4, true, true], "4 4 4 0 0 true"),
    positive(
      "200 runs list with state, stage and persona and no event read",
      [200, 50, false],
      "200 50 50 50 0 true",
    ),
    positive(
      "runs that are not running show no stage and no persona",
      [200, 0, false],
      "200 0 0 0 0 true",
    ),
    positive("a single running run shows its step and persona", [1, 1, false], "1 1 1 1 0 true"),
  ],
  negative: [
    rejected(
      "a cursor before all rows returns an empty page",
      [5, 0, false, false, 1, 2],
      "0 0 0 0 0 true",
    ),
    negative("a zero cursor is refused", [5, 0, false, false, 0, 2], { name: "ZodError" }),
    negative("an oversized page is refused", [5, 0, false, false, 3, 201], { name: "ZodError" }),
    rejected("stored terminal runs have no active stage", [4, 0, false, true], "4 0 0 0 0 true"),
    rejected("empty stored catalog performs no snapshots", [0, 0, false, true], "0 0 0 0 0 true"),
    rejected("a running script step has a stage but no persona", [4, 4, true], "4 4 4 0 0 true"),
    rejected("an empty project lists no runs", [0, 0, false], "0 0 0 0 0 true"),
  ],
};
