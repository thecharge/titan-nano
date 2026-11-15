import { HttpStatus, ServerKillCheck, ServerRunCheck, ServerStreamCheck } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverRunCases = {
  positive: [
    positive("answer to the post holds the run id shown by the get", [ServerRunCheck.RunId], true),
    positive("run shows running or passed", [ServerRunCheck.State], true),
  ],
  negative: [
    rejected(
      "post without the agent token is refused",
      [ServerRunCheck.NoToken],
      HttpStatus.Unauthorized,
    ),
    rejected(
      "post with an empty workflow is refused",
      [ServerRunCheck.Invalid],
      HttpStatus.BadRequest,
    ),
  ],
};

export const serverStreamCases = {
  positive: [
    positive("later events follow in order without a gap", [ServerStreamCheck.Continuous], true),
    positive(
      "no event repeats or comes from before the cursor",
      [ServerStreamCheck.Duplicates],
      true,
    ),
    positive("at least ten later events arrive", [ServerStreamCheck.Count], true),
  ],
  negative: [
    rejected(
      "malformed Last-Event-ID is refused",
      [ServerStreamCheck.BadCursor],
      HttpStatus.BadRequest,
    ),
    rejected(
      "future Last-Event-ID is refused",
      [ServerStreamCheck.FutureCursor],
      HttpStatus.Conflict,
    ),
    rejected(
      "stream without the agent token is refused",
      [ServerStreamCheck.NoToken],
      HttpStatus.Unauthorized,
    ),
  ],
};

export const serverKillCases = {
  positive: [
    positive("same steps are shown after the restart", [ServerKillCheck.Steps], true),
    positive("board has step_restarted for the killed step", [ServerKillCheck.Restarted], true),
    positive("step_restarted keeps the logical attempt", [ServerKillCheck.Attempt], true),
    positive("recovery starts no agent by itself", [ServerKillCheck.NoRerun], true),
  ],
  negative: [
    rejected("finished earlier step gets no step_restarted", [ServerKillCheck.OtherStep], false),
    rejected("recovery does not reset the attempt", [ServerKillCheck.AttemptReset], false),
  ],
};
