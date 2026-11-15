import { positive, rejected } from "@titan/test-factories";

export const improverRecordCases = {
  positive: [
    positive(
      "improver task holds the workflow file, the attempts and the evidence of a refuted step",
      [1, true],
      "1 true true true failed failed true",
    ),
    positive(
      "improver task holds the workflow file and the single attempt of a passed step",
      [1, false],
      "1 true true false passed passed true",
    ),
  ],
  negative: [
    rejected(
      "no improver starts when rounds is 0",
      [0, true],
      "0 false false false null failed false",
    ),
    rejected(
      "no improver starts when the workflow file has no improve part",
      [undefined, false],
      "0 false false false null passed false",
    ),
  ],
};
