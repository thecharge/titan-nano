import { DashboardCommandFixture, DashboardCommandScenario, ErrorCode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const dashboardCommandCases = {
  positive: [
    positive(
      "default services start the server when none runs and print a working link",
      [DashboardCommandScenario.StartsServer],
      `${DashboardCommandFixture.Started} 303`,
    ),
    positive(
      "text mode prints the link as one line",
      [DashboardCommandScenario.TextLine],
      "1 true",
    ),
    positive(
      "json mode goes through the renderer and prints one object with the link",
      [DashboardCommandScenario.JsonObject],
      "1 dashboard link true",
    ),
    positive(
      "code works once and is refused on the second use",
      [DashboardCommandScenario.OnceThenRefused],
      "303 403",
    ),
    positive(
      "code still works just before 60 s",
      [DashboardCommandScenario.OnceThenRefused, DashboardCommandFixture.Alive],
      "303 403",
    ),
    positive(
      "code and cookie stay out of logs and files",
      [DashboardCommandScenario.NoLeak],
      DashboardCommandFixture.Clean,
    ),
  ],
  negative: [
    rejected(
      "answer whose url does not match its code is rejected",
      [DashboardCommandScenario.MismatchedUrl],
      ErrorCode.InvalidResponse,
    ),
    rejected(
      "stale server file for a dead server gives server unavailable",
      [DashboardCommandScenario.StaleAddress],
      ErrorCode.ServerUnavailable,
    ),
    rejected(
      "code is refused after 60 s",
      [DashboardCommandScenario.OnceThenRefused, DashboardCommandFixture.Expired],
      "403 403",
    ),
    rejected(
      "extra argument is refused",
      [DashboardCommandScenario.ExtraArgument],
      ErrorCode.Arguments,
    ),
    rejected("watch flag is refused", [DashboardCommandScenario.WatchFlag], ErrorCode.Arguments),
    rejected(
      "wrong person token is refused by the server",
      [DashboardCommandScenario.WrongPersonToken],
      ErrorCode.PermissionDenied,
    ),
  ],
};
