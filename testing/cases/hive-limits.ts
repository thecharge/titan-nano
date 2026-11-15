import { positive, rejected } from "@titan/test-factories";

export const runawayAgentCases = {
  positive: [
    positive(
      "ten steps allowed and fifty tried leave ten steps and one request",
      [10, 50],
      "10 41 1",
    ),
    positive(
      "three steps allowed and five tried leave three steps and one request",
      [3, 5],
      "3 3 1",
    ),
  ],
  negative: [
    rejected("tries below the limit refuse nothing and open no request", [10, 5], "6 0 0"),
    rejected("a plan already at the limit refuses every try with one request", [1, 2], "1 2 1"),
  ],
};
