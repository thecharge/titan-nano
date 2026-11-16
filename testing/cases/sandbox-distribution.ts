import { positive, rejected } from "@titan/test-factories";

export const sandboxDistributionCases = {
  positive: [
    positive("Linux archive carries its complete helper inventory", [true, "none"], true),
    positive("macOS archive uses the operating system sandbox", [false, "none"], true),
  ],
  negative: [
    rejected("archive rejects nested removed helpers", [true, "nested"], true),
    rejected("archive rejects the removed executable", [true, "helper"], true),
    rejected("archive rejects the removed source cache", [false, "source"], true),
    rejected("archive rejects an incomplete component inventory", [true, "inventory"], true),
    rejected("archive rejects missing component notices", [true, "notices"], true),
    rejected("archive rejects missing native executable", [true, "missing"], true),
    rejected("archive rejects a GPL-only native dependency", [true, "license"], true),
  ],
};
