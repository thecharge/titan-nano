import { positive, rejected } from "@titan/test-factories";

export const submissionCaptureRetryCases = {
  positive: [
    positive(
      "a refused snapshot retry retains its original mutation version",
      [true, false, true],
      true,
    ),
    positive(
      "entry-limit recovery retains its original mutation version",
      [false, false, true],
      true,
    ),
    positive("a refused snapshot retries its reserved submission and starts", [true, false], true),
    positive("entry-limit recovery starts the original reserved run", [false, false], true),
  ],
  negative: [
    rejected("restart cannot duplicate a refused snapshot's mutation", [true, true, true], true),
    rejected("restart cannot duplicate an entry-limited mutation", [false, true, true], true),
    rejected("restart cannot strand a refused snapshot reservation", [true, true], true),
    rejected("restart cannot strand an entry-limited reservation", [false, true], true),
  ],
};

export const submissionProjectCases = {
  positive: [
    positive("a project directory admits its workflow", ["directory"], true),
    positive("a nested project directory admits its workflow", ["nested"], true),
  ],
  negative: [
    rejected("a regular file refuses before reserving a run", ["file"], true),
    rejected("a file parent refuses before reserving a run", ["file-parent"], true),
    rejected("a missing directory refuses before reserving a run", ["missing"], true),
  ],
};
