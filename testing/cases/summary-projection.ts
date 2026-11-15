import { positive, rejected } from "@titan/test-factories";

export const summaryProjectionCases = {
  positive: [
    positive("creation persists a summary before acknowledgement", [false, false], true),
    positive("completion replaces the stored summary without listing replay", [false, true], true),
  ],
  negative: [
    rejected(
      "missing commit event rebuilds identical measurements",
      [false, true, "missing"],
      true,
    ),
    rejected("a mismatched cursor rebuilds identical measurements", [false, true, "gap"], true),
    rejected("projection failure refuses creation acknowledgement", [true, false], true),
    rejected(
      "failed completion projection cannot acknowledge a successful snapshot",
      [true, true],
      true,
    ),
  ],
};

export const summaryCacheCases = {
  positive: [
    positive("running cache needs no journal replay", ["running"], true),
    positive("terminal cache needs no journal replay", ["finished"], true),
  ],
  negative: [
    rejected("stale summary is unavailable without replay", ["stale"], true),
    rejected("crossed summary identity cannot be displayed", ["crossed"], true),
    rejected("legacy running cache requires one explicit migration", ["legacy"], true),
  ],
};

export const summaryMigrationCases = {
  positive: [
    positive("stable running migration remains cached", ["running"], true),
    positive("stable terminal migration remains cached", ["finished"], true),
  ],
  negative: [
    rejected("an append during inspection invalidates the old migration", ["append"], true),
    rejected(
      "a committed completion during inspection invalidates the old migration",
      ["commit"],
      true,
    ),
  ],
};
