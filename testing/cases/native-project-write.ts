import { Backend } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeProjectWriteCases = {
  positive: [
    positive(
      "Codex private project writes publish after checking and survive reopen",
      [Backend.Codex, false],
      true,
    ),
    positive(
      "Claude private project writes publish after checking and survive reopen",
      [Backend.Claude, false],
      true,
    ),
  ],
  negative: [
    rejected("Codex refutation discards private project writes", [Backend.Codex, true], true),
    rejected("Claude refutation discards private project writes", [Backend.Claude, true], true),
  ],
};
