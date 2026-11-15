import {
  BackgroundFixture,
  CatalogFixture,
  ErrorCode,
  RunStatus,
  ServerState,
} from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const catalogIsolationCases = {
  positive: [
    positive(
      "two healthy runs remain independently visible",
      [CatalogFixture.Healthy],
      RunStatus.Passed,
    ),
    positive(
      "incomplete initialization retains a visible catalog row",
      [CatalogFixture.Missing],
      ServerState.InitializationIncomplete,
    ),
  ],
  negative: [
    rejected(
      "corrupt journal does not hide the healthy run",
      [CatalogFixture.Corrupt],
      ServerState.ReadUnavailable,
    ),
    rejected(
      "unreadable journal does not stop global inspection",
      [CatalogFixture.Directory],
      ServerState.ReadUnavailable,
    ),
  ],
};

export const listingResponseCases = {
  positive: [
    positive("empty catalog is a valid typed listing", [[]], true),
    positive(
      "unavailable row retains identity and a diagnostic",
      [
        [
          {
            run_id: "one",
            client_id: "caller",
            state: ServerState.ReadUnavailable,
            project: null,
            error: "Journal cannot be read",
          },
        ],
      ],
      true,
    ),
  ],
  negative: [
    negative(
      "unknown catalog state fails at the client boundary",
      [[{ run_id: "one", client_id: "caller", state: "invented", project: null }]],
      { code: ErrorCode.InvalidResponse },
    ),
    negative(
      "missing catalog identity cannot enter the client",
      [[{ client_id: "caller", state: RunStatus.Passed, project: "/project" }]],
      { code: ErrorCode.InvalidResponse },
    ),
  ],
};

export const startIsolationCases = {
  positive: [
    positive(
      "completed background run leaves another run independent",
      [BackgroundFixture.Healthy],
      RunStatus.Passed,
    ),
    positive(
      "operational stop blocks without a quality refutation",
      [BackgroundFixture.Operational],
      RunStatus.Blocked,
    ),
  ],
  negative: [
    rejected(
      "initial append failure is contained and another run completes",
      [BackgroundFixture.AppendFailure],
      ServerState.ReadUnavailable,
    ),
    rejected(
      "initial projection failure is contained and another run completes",
      [BackgroundFixture.ProjectionFailure],
      ServerState.ReadUnavailable,
    ),
  ],
};
