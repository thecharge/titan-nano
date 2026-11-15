import { Backend } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeSetupProcessCases = {
  positive: [
    positive(
      "Codex recovers owner capacity refusal without a false model start",
      [Backend.Codex, 1, false],
      true,
    ),
    positive(
      "Claude recovers owner capacity refusal after daemon crash",
      [Backend.Claude, 1, true],
      true,
    ),
  ],
  negative: [
    rejected("Codex daemon reload cannot refill setup allowance", [Backend.Codex, 0, true], true),
    rejected(
      "Claude setup refusal cannot bypass frozen allowance",
      [Backend.Claude, 0, false],
      true,
    ),
  ],
};
