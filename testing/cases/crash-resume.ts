import { Backend } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const crashResumeCases = {
  positive: [
    positive(
      "Codex resumes interrupted files without repeating completed cause",
      [Backend.Codex, 1],
      true,
    ),
    positive(
      "Claude resumes interrupted files without repeating completed cause",
      [Backend.Claude, 1],
      true,
    ),
  ],
  negative: [
    rejected(
      "Codex exhausted allowance preserves completed cause and interrupted attempt",
      [Backend.Codex, 0],
      true,
    ),
    rejected(
      "Claude exhausted allowance preserves completed cause and interrupted attempt",
      [Backend.Claude, 0],
      true,
    ),
  ],
};
