import { ProofAnswer, ScriptCheckCase } from "@titan/constants";
import { RunnerMessage } from "@titan/messages";
import { positive, rejected } from "@titan/test-factories";

export const scriptAnswerCases = {
  positive: [
    positive(ScriptCheckCase.FirstOnly, [true, [0, 0]], [ProofAnswer.Proven, "0", 2]),
    positive(ScriptCheckCase.Later, [false, [0]], [ProofAnswer.Proven, "0", 1]),
    positive(ScriptCheckCase.Twice, [true, [1, 1]], [ProofAnswer.NotProven, "1", 2]),
  ],
  negative: [
    rejected(
      ScriptCheckCase.Changing,
      [true, [0, 1]],
      [ProofAnswer.NotProven, RunnerMessage.ScriptDiffers, 2],
    ),
    rejected(
      ScriptCheckCase.ChangingBack,
      [true, [1, 0]],
      [ProofAnswer.NotProven, RunnerMessage.ScriptDiffers, 2],
    ),
    rejected(ScriptCheckCase.LaterFailing, [false, [1, 0]], [ProofAnswer.NotProven, "1", 1]),
    rejected(ScriptCheckCase.Failing, [false, [2]], [ProofAnswer.NotProven, "2", 1]),
  ],
};
