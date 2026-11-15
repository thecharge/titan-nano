import { Backend } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const helperProcessCases = {
  positive: [
    positive(
      "Codex resumes its asking session after automatic persona help",
      [Backend.Codex, false],
      true,
    ),
    positive(
      "Claude resumes its asking session after automatic persona help",
      [Backend.Claude, false],
      true,
    ),
  ],
  negative: [
    rejected("Codex waits for raised approval before persona help", [Backend.Codex, true], true),
    rejected("Claude waits for raised approval before persona help", [Backend.Claude, true], true),
  ],
};
