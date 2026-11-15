import { ErrorCode, LiveWorkspaceFixture as Fixture, RunStatus } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const outcome = (
  state: RunStatus,
  builders: number,
  checkers: number,
  checks: number,
  fed: boolean,
  text: string,
) => ({ state, builders, checkers, checks, fed, text });

export const checksNeedScriptCases = {
  positive: [
    positive("a step proof is admitted with its script service", [true, true], true),
    positive("a plan with checks is accepted when scripts are approved", [true], true),
    positive("a plan with checks creates a run when a script runner is present", [true], true),
  ],
  negative: [
    negative("a step proof is refused before workers without a script service", [false, true], {
      code: ErrorCode.ScriptPending,
    }),
    negative("a plan with checks is refused without scripts", [false], {
      code: ErrorCode.ScriptPending,
    }),
    negative("a refused plan does not create a run", [false], { code: ErrorCode.ScriptPending }),
  ],
};

export const failingCheckCases = {
  positive: [
    positive(
      "a failing check sends its output to the builder and the step passes after the check passes",
      [[1, 0], Fixture.RetryAttempts],
      outcome(RunStatus.Passed, 2, 1, 2, true, Fixture.New),
    ),
    positive(
      "a passing check lets the checker start with one builder attempt",
      [[0], Fixture.RetryAttempts],
      outcome(RunStatus.Passed, 1, 1, 1, false, Fixture.New),
    ),
  ],
  negative: [
    rejected(
      "a failing check on the first attempt needs a second builder attempt",
      [[1, 0], Fixture.RetryAttempts],
      outcome(RunStatus.Passed, 2, 1, 2, true, Fixture.New),
    ),
    rejected(
      "a passing check sends no output to the builder",
      [[0], Fixture.RetryAttempts],
      outcome(RunStatus.Passed, 1, 1, 1, false, Fixture.New),
    ),
  ],
};

export const neverPassingCheckCases = {
  positive: [
    positive(
      "a check that fails at the attempt limit fails the step and puts the files back",
      [[1], Fixture.RetryAttempts],
      outcome(RunStatus.Failed, 2, 0, 2, true, Fixture.Old),
    ),
    positive(
      "a check that fails on a single attempt fails the step and puts the files back",
      [[1], Fixture.Attempts],
      outcome(RunStatus.Failed, 1, 0, 1, false, Fixture.Old),
    ),
  ],
  negative: [
    rejected(
      "a check that never passes never lets the checker start",
      [[1], Fixture.RetryAttempts],
      outcome(RunStatus.Failed, 2, 0, 2, true, Fixture.Old),
    ),
    rejected(
      "a check that never passes leaves the old text in the project",
      [[1], Fixture.Attempts],
      outcome(RunStatus.Failed, 1, 0, 1, false, Fixture.Old),
    ),
  ],
};
