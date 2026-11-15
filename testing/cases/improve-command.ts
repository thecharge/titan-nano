import { ErrorCode, ImproveLoopScenario, RunStatus } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const finished = RunStatus.Passed;
const same = ImproveLoopScenario.AnswerSame;
const kept = "new workflow files kept: 1 of 1 rounds run|1";

export const improveCommandCases = {
  positive: [
    positive(
      "persona and rounds flags run the loop once for a file without an improve part",
      [ImproveLoopScenario.PartNone, same, finished, ["--persona", "improver", "--rounds", "1"]],
      kept,
    ),
    positive(
      "the improve part of the workflow file sets persona and rounds",
      [ImproveLoopScenario.PartFull, same, finished, []],
      kept,
    ),
    positive(
      "an improve part without a persona uses the default improver",
      [ImproveLoopScenario.PartRounds, same, finished, []],
      kept,
    ),
    positive(
      "the rounds flag alone uses the default improver",
      [ImproveLoopScenario.PartNone, same, finished, ["--rounds", "1"]],
      kept,
    ),
  ],
  negative: [
    rejected(
      "a new file the schema refuses is not kept and the command says so",
      [ImproveLoopScenario.PartNone, ImproveLoopScenario.AnswerBroken, finished, ["--rounds", "1"]],
      "new workflow files kept: 0 of 1 rounds run|0",
    ),
    negative(
      "no improve part and no rounds flag leaves nothing to run",
      [ImproveLoopScenario.PartNone, same, finished, []],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "rounds 0 is refused before any run is read",
      [ImproveLoopScenario.PartNone, same, finished, ["--rounds", "0"]],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "a run still running cannot be improved",
      [ImproveLoopScenario.PartFull, same, RunStatus.Running, []],
      { code: ErrorCode.Arguments },
    ),
  ],
};
