import { ErrorCode, ExitCode, ServerSecondCheck } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

const locked = { code: ErrorCode.ServerLocked, exitCode: ExitCode.Input };

export const serverSecondCases = {
  positive: [
    positive(
      "first server keeps its address after a refusal",
      [ServerSecondCheck.Preserved],
      "200 true",
    ),
    positive("two homes run two servers", [ServerSecondCheck.OtherHome], "200 200"),
    positive("a new server starts after the first one stops", [ServerSecondCheck.Restarted], "200"),
  ],
  negative: [
    negative(
      "second server for the same home exits with code 2",
      [ServerSecondCheck.Refused],
      locked,
    ),
    negative(
      "second server through a dotted path exits with code 2",
      [ServerSecondCheck.Dotted],
      locked,
    ),
  ],
};
