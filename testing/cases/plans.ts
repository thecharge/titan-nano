import { CliCommand, ErrorCode, PlanScenario } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

function printed(...rewards: readonly number[]): string {
  return rewards.join(PlanScenario.Join);
}

const argumentsError = { code: ErrorCode.Arguments };

export const plansCommandCases = {
  positive: [
    positive(
      "titan plans code-fix prints the 3 best of 5 kept plans",
      [
        [CliCommand.Plans, PlanScenario.Kind],
        [0.2, 0.7, 0.5, 0.9, 0.4],
      ],
      printed(0.9, 0.7, 0.5),
    ),
    positive(
      "titan plans prints an empty list for a kind with no plans",
      [[CliCommand.Plans, PlanScenario.Missing], [0.2]],
      printed(),
    ),
  ],
  negative: [
    negative("titan plans needs a kind", [[CliCommand.Plans], [0.2]], argumentsError),
    negative(
      "titan plans refuses extra arguments",
      [[CliCommand.Plans, PlanScenario.Kind, PlanScenario.Other], [0.2]],
      argumentsError,
    ),
  ],
};

export const plansBeforeDesignCases = {
  positive: [
    positive(
      "5 code-fix runs kept with rewards 0.2, 0.7, 0.5, 0.9 and 0.4 print 0.9, 0.7 and 0.5 in that order",
      [[0.2, 0.7, 0.5, 0.9, 0.4], [], PlanScenario.Kind],
      printed(0.9, 0.7, 0.5),
    ),
    positive(
      "two kept plans print both with the higher reward first",
      [[0.3, 0.8], [], PlanScenario.Kind],
      printed(0.8, 0.3),
    ),
  ],
  negative: [
    rejected(
      "a kind with no kept plans prints no plans",
      [[0.2, 0.7], [], PlanScenario.Missing],
      PlanScenario.Empty,
    ),
    rejected(
      "plans of another kind with a higher reward are not printed",
      [[0.1], [0.99, 0.98], PlanScenario.Kind],
      printed(0.1),
    ),
  ],
};
