import { HttpStatus, RunStatus, ServerRestartCheck } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverRestartCases = {
  positive: [
    positive(
      "kept run is still passed after the restart",
      [ServerRestartCheck.State],
      RunStatus.Passed,
    ),
    positive(
      "recorded project folder is used, not the new folder",
      [ServerRestartCheck.Project],
      "true true",
    ),
    positive("kept result's agent does not run again", [ServerRestartCheck.Agents], true),
    positive("kept result path is the same", [ServerRestartCheck.Result], true),
  ],
  negative: [
    rejected(
      "unknown run id is refused after the restart",
      [ServerRestartCheck.Missing],
      HttpStatus.BadRequest,
    ),
    rejected(
      "run is not known to another home",
      [ServerRestartCheck.OtherHome],
      HttpStatus.BadRequest,
    ),
  ],
};
