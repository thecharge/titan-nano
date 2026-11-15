import { RunStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";
export const mcpSubmissionCases = {
  positive: [
    positive(
      "sequential workers continue after bounded tool acknowledgement",
      [false, false],
      true,
    ),
    positive("parallel workers continue after bounded tool acknowledgement", [true, false], true),
  ],
  negative: [
    rejected("empty sequential workflow starts no worker", [false, true], true),
    rejected("unknown parallel personas start no worker", [true, true], true),
  ],
};
export const mcpSubmissionResponseCases = {
  positive: [
    positive("active assigned run is accepted", [RunStatus.Running, true], true),
    positive("settled assigned run is accepted", [RunStatus.Passed, true], true),
  ],
  negative: [
    rejected("malformed active acknowledgement is a tool error", [RunStatus.Running, false], false),
    rejected("malformed settled acknowledgement is a tool error", [RunStatus.Passed, false], false),
  ],
};
