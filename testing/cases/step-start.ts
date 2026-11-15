import { StepStart } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const stepStartCases = {
  positive: [
    positive(
      "step starts after the one result it needs survived",
      [[StepStart.Cause], [], false],
      "1 true 0",
    ),
    positive(
      "step starts after both results it needs survived",
      [[StepStart.Cause, StepStart.Trace], [], false],
      "1 true 0",
    ),
    positive(
      "step starts after its input survived while an unrelated step runs",
      [[StepStart.Cause], [], true],
      "1 true 0",
    ),
  ],
  negative: [
    rejected(
      "step never starts when the result it needs is refuted",
      [[StepStart.Cause], [StepStart.Cause], false],
      "0 false 0",
    ),
    rejected(
      "step never starts when one of two results it needs is refuted",
      [[StepStart.Cause, StepStart.Trace], [StepStart.Trace], false],
      "0 false 0",
    ),
  ],
};
