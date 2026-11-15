import { positive, rejected } from "@titan/test-factories";

export const operationalEvidenceCases = {
  positive: [
    positive("worker interruption stays outside later quality prompts", [true, false], true),
    positive(
      "checker interruption stays outside quality prompts after reload",
      [false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "repeated worker interruption keeps zero quality evidence after reload",
      [true, true, true],
      true,
    ),
    rejected(
      "repeated checker interruption keeps zero quality evidence",
      [false, false, true],
      true,
    ),
  ],
};
