import { ErrorCode, StepStatus } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const reason = "same result with half the steps";
const protocol = { code: ErrorCode.CheckerProtocol };

export const threeCandidatesTwoSurviveCases = {
  positive: [
    positive("judge picks the first of candidates 2 and 3", ["A"], `1-2|1|FSS|${reason}`),
    positive("judge picks the second of candidates 2 and 3", ["B"], `1-2|2|FSS|${reason}`),
  ],
  negative: [
    negative("a winner outside A and B is refused", ["C"], protocol),
    negative("a lower case winner is refused", ["a"], protocol),
  ],
};

export const oneCandidateSurvivesCases = {
  positive: [
    positive("only candidate 2 survives and is kept without a judge", [[1]], "0|1"),
    positive("only candidate 3 survives and is kept without a judge", [[2]], "0|2"),
  ],
  negative: [
    rejected("two survivors call the judge once", [[1, 2]], "1|1"),
    rejected("the first and third survivors call the judge once", [[0, 2]], "1|0"),
  ],
};

export const noCandidateSurvivesCases = {
  positive: [
    positive("three candidates all refuted fail the step", [3, []], `${StepStatus.Failed}|null|0`),
    positive("two candidates all refuted fail the step", [2, []], `${StepStatus.Failed}|null|0`),
  ],
  negative: [
    rejected("one survivor of three passes the step", [3, [2]], `${StepStatus.Passed}|2|0`),
    rejected("one survivor of two passes the step", [2, [0]], `${StepStatus.Passed}|0|0`),
  ],
};

export const judgePicksBCases = {
  positive: [
    positive("B keeps the second candidate and stores the reason", ["B", reason], `1|${reason}`),
    positive("B with another reason stores that reason", ["B", "fewer tokens"], "1|fewer tokens"),
  ],
  negative: [
    negative("an empty reason is refused", ["B", ""], protocol),
    negative("a blank reason is refused", ["B", "   "], protocol),
  ],
};
