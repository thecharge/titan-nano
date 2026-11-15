import { PersonaBound, WilsonCheck, WilsonRun } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const wilsonExampleCases = {
  positive: [
    positive(
      "test-strategy > Wilson bound examples: 17 of 20 has lower bound 0.640",
      [17, 20, PersonaBound.Lower],
      "0.640",
    ),
    positive(
      "test-strategy > Wilson bound examples: 16 of 20 has lower bound 0.584",
      [16, 20, PersonaBound.Lower],
      "0.584",
    ),
    positive(
      "test-strategy > Wilson bound examples: 16 of 20 has upper bound 0.919",
      [16, 20, PersonaBound.Upper],
      "0.919",
    ),
    positive(
      "test-strategy > Wilson bound examples: 1 of 8 has upper bound 0.471",
      [1, 8, PersonaBound.Upper],
      "0.471",
    ),
  ],
  negative: [
    rejected(
      "test-strategy > Wilson bound examples: 17 of 20 does not have lower bound 0.584",
      [17, 20, PersonaBound.Lower],
      "0.640",
    ),
    rejected(
      "test-strategy > Wilson bound examples: 1 of 8 does not have upper bound 0.640",
      [1, 8, PersonaBound.Upper],
      "0.471",
    ),
  ],
};

export const wilsonPairCases = {
  positive: [
    positive(
      "persona-lifecycle > Wilson bound examples: 17 of 20 gives 0.640 and 0.948",
      [17, 20],
      "0.640 0.948",
    ),
    positive(
      "persona-lifecycle > Wilson bound examples: 1 of 8 gives 0.022 and 0.471",
      [1, 8],
      "0.022 0.471",
    ),
    positive(
      "persona-lifecycle > Wilson bound property: zero results give 0 and 1",
      [0, 0],
      "0.000 1.000",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > Wilson bound examples: 16 of 20 is not the pair of 17 of 20",
      [16, 20],
      "0.584 0.919",
    ),
    rejected(
      "persona-lifecycle > Wilson bound property: a total of 1 does not give 0 and 1",
      [0, 1],
      "0.000 0.793",
    ),
  ],
};

export const wilsonPropertyCases = {
  positive: [
    positive(
      "test-strategy > Wilson bound property: 1000 cases with seed 42 break no rule",
      [WilsonRun.Seed, WilsonRun.Runs, WilsonCheck.Holds],
      "1000 0",
    ),
    positive(
      "test-strategy > Wilson bound property: 200 cases with seed 7 break no rule",
      [7, 200, WilsonCheck.Holds],
      "200 0",
    ),
  ],
  negative: [
    rejected(
      "test-strategy > Wilson bound property: the reversed rule is broken in every case",
      [WilsonRun.Seed, WilsonRun.Runs, WilsonCheck.Reversed],
      "1000 1000",
    ),
    rejected(
      "test-strategy > Wilson bound property: the reversed rule is broken in all 50 cases",
      [7, 50, WilsonCheck.Reversed],
      "50 50",
    ),
  ],
};

export const wilsonWidthPropertyCases = {
  positive: [
    positive(
      "four times the evidence narrows every interval with seed 42",
      [WilsonRun.Seed, WilsonRun.Runs, WilsonCheck.Holds],
      "1000 0",
    ),
    positive(
      "four times the evidence narrows every interval with seed 7",
      [7, 200, WilsonCheck.Holds],
      "200 0",
    ),
  ],
  negative: [
    rejected(
      "the reversed width rule fails every generated case with seed 42",
      [WilsonRun.Seed, WilsonRun.Runs, WilsonCheck.Reversed],
      "1000 1000",
    ),
    rejected(
      "the reversed width rule fails every generated case with seed 7",
      [7, 50, WilsonCheck.Reversed],
      "50 50",
    ),
  ],
};
