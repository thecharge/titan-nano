import { ExecutionPhase, RunStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const complete = { state: RunStatus.Passed, opened: 4, turns: 4, executions: 1 };
const blocked = { state: RunStatus.Blocked, opened: 2, turns: 2, executions: 0 };
export const taskInputCases = {
  positive: [
    positive("one input reference completes", [1], complete),
    positive("six expanded references fit both prompt allowances", [6], complete),
  ],
  negative: [
    rejected(
      "checker candidate pushes seven inputs over allowance",
      [7, `${ExecutionPhase.FalsifierPrefix}0`],
      { ...blocked, opened: 3, turns: 3 },
    ),
    rejected("eight expanded references exceed the allowance", [8], blocked),
    rejected("twenty expanded references spend no execution", [20], blocked),
  ],
};
