import { ErrorCode, RunCompatibilityFixture, RunFormat } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const runCompatibilityCases = {
  positive: [
    positive(
      "legacy checkpoint remains readable after daemon restart",
      [RunFormat.Legacy, null],
      true,
    ),
    positive(
      "caller-labelled checkpoint remains readable after daemon restart",
      [RunFormat.CallerSessions, null],
      true,
    ),
  ],
  negative: [
    rejected(
      "next format refuses controls without repairing its incomplete tail",
      [RunCompatibilityFixture.Future, ErrorCode.UnsupportedRunFormat],
      true,
    ),
    rejected(
      "distant format retains journal and projection with recovery guidance",
      [RunCompatibilityFixture.DistantFuture, ErrorCode.UnsupportedRunFormat],
      true,
    ),
  ],
};

export const storeCompatibilityCases = {
  positive: [
    positive("store reads the legacy format", [RunFormat.Legacy, null, false], true),
    positive(
      "store commits the caller-labelled format",
      [RunFormat.CallerSessions, null, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "store refuses next-format replay before tail repair",
      [RunCompatibilityFixture.Future, ErrorCode.UnsupportedRunFormat, false],
      true,
    ),
    rejected(
      "store refuses next-format append and keeps its queue usable",
      [RunCompatibilityFixture.Future, ErrorCode.UnsupportedRunFormat, true],
      true,
    ),
    rejected(
      "store refuses distant-format replay before projection",
      [RunCompatibilityFixture.DistantFuture, ErrorCode.UnsupportedRunFormat, false],
      true,
    ),
    rejected(
      "store refuses distant-format append before writes",
      [RunCompatibilityFixture.DistantFuture, ErrorCode.UnsupportedRunFormat, true],
      true,
    ),
  ],
};
