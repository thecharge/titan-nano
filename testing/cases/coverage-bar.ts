import { positive, rejected } from "@titan/test-factories";

export const coverageBarCases = {
  positive: [
    positive("a fully covered project passes the bar", [false], 0),
    positive("a fully covered project passes again on a repeat run", [false], 0),
  ],
  negative: [
    rejected(
      "test-strategy > Coverage under the bar: an untested function fails the run",
      [true],
      1,
    ),
    rejected("an untested function fails again on a repeat run", [true], 1),
  ],
};
