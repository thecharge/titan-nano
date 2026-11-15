import { positive, rejected } from "@titan/test-factories";

export const activeResumeCases = {
  positive: [
    positive("active worker admits its exact execution origin", [false, false], true),
    positive("active checker admits its exact execution origin", [true, false], true),
  ],
  negative: [
    rejected("duplicate resume cannot reset an active worker", [false, true], true),
    rejected("duplicate resume cannot reset an active checker", [true, true], true),
    rejected(
      "duplicate worker resume preserves its completed parallel peer",
      [false, true, true],
      true,
    ),
    rejected(
      "duplicate checker resume preserves its completed parallel peer",
      [true, true, true],
      true,
    ),
  ],
};
