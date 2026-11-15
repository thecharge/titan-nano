import { positive, rejected } from "@titan/test-factories";

export const catalogDecisionCases = {
  positive: [
    positive(
      "every catalog package is named",
      [{ zod: "4.6.7", "@scope/pkg": "1.0.0" }, "Use zod and @scope/pkg."],
      [],
    ),
    positive("an empty catalog needs no decision", [{}, ""], []),
  ],
  negative: [
    rejected(
      "dev-standards > A new dependency",
      [{ zod: "4.6.7", "new-library": "1.0.0" }, "Use zod only."],
      ["new-library"],
    ),
    rejected("several missing packages are all reported", [{ a: "1", b: "2" }, "none"], ["a", "b"]),
  ],
};
