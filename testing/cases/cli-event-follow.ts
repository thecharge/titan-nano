import { CliEventFormat, ErrorCode } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const cliEventFollowCases = {
  positive: [
    positive("JSON lines drain contiguous pages before waiting", [true, false], true),
    positive("human following drains contiguous compact lines", [false, false], true),
  ],
  negative: [
    rejected(
      "JSON following retains only the valid prefix on transport failure",
      [true, true],
      true,
    ),
    rejected("human following reports the transport failure", [false, true], true),
  ],
};
export const cliEventFollowOptionCases = {
  positive: [
    positive("finite JSON query is valid", [{ json: true }], undefined),
    positive(
      "JSON line following is valid",
      [{ follow: true, format: CliEventFormat.JsonLines }],
      undefined,
    ),
    positive("human following is valid", [{ follow: true }], undefined),
  ],
  negative: [
    negative("ordinary JSON cannot mix with following", [{ follow: true, json: true }], {
      code: ErrorCode.Arguments,
    }),
    negative("line format requires following", [{ format: CliEventFormat.JsonLines }], {
      code: ErrorCode.Arguments,
    }),
    negative("unknown line format is refused", [{ follow: true, format: "xml" }], {
      code: ErrorCode.Arguments,
    }),
  ],
};

export const cliEventFollowProcessCases = {
  positive: [
    positive("sequential run supplies versioned live event lines", [false, true], true),
    positive("parallel run supplies versioned live event lines", [true, true], true),
  ],
  negative: [
    rejected("interrupting sequential human follow leaves work running", [false, false], true),
    rejected("interrupting parallel human follow leaves work running", [true, false], true),
  ],
};
