import { RequestState, ToolWait, ToolWaitFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const waiting = `${RequestState.Waiting} true`;
const sameSession = "true false false true 2";
const spent = "false false false true 1";

export const toolWaitsCases = {
  positive: [
    positive(
      "tool request returns at once with the waiting state",
      [ToolWaitFixture.Waiting],
      waiting,
    ),
    positive(
      "human-level request also returns at once with the waiting state",
      [ToolWaitFixture.Human],
      waiting,
    ),
    positive(
      "answer later reaches the same session after the tool returned",
      [ToolWaitFixture.Answered],
      `${waiting} ${sameSession}`,
    ),
  ],
  negative: [
    rejected(
      "unanswered request spends no turn of the session",
      [ToolWaitFixture.Unanswered],
      `${waiting} ${spent}`,
    ),
    rejected(
      "invalid scope returns an error at once and opens no request",
      [ToolWaitFixture.InvalidScope],
      `${ToolWait.Error} true`,
    ),
  ],
};
