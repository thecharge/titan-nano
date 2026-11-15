import { positive, rejected } from "@titan/test-factories";

export const persistedDashboardCases = {
  positive: [
    positive("200 summaries survive restart with two resident slots", [200, false], true),
    positive("a past run is inspected without creating its event index", [1, false], true),
  ],
  negative: [
    rejected("invalid projection stamps rebuild before readiness", [1, false, "stamp"], true),
    rejected(
      "a mismatched run state cannot supply retained measurements",
      [1, false, "state"],
      true,
    ),
    rejected("another workflow cannot supply retained measurements", [1, false, "workflow"], true),
    rejected("stale measurements rebuild before dashboard readiness", [1, false, "stale"], true),
    rejected(
      "another run identity cannot supply retained measurements",
      [1, false, "identity"],
      true,
    ),
    rejected("invalid measurement JSON rebuilds from committed events", [1, false, "json"], true),
    rejected("invalid measurement shape rebuilds from committed events", [1, false, "shape"], true),
    rejected("inspection retains a partial trailing journal byte for byte", [200, true], true),
    rejected("an empty persisted catalog stays empty", [0, false], true),
  ],
};
