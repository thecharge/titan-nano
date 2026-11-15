import { Backend } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeScriptReconciliationCases = {
  positive: [
    positive(
      "Codex reconciles an approved received script without replay",
      [Backend.Codex, 1],
      true,
    ),
    positive(
      "Claude reconciles an approved received script without replay",
      [Backend.Claude, 1],
      true,
    ),
  ],
  negative: [
    rejected(
      "Codex retains a received script when its allowance is spent",
      [Backend.Codex, 0],
      true,
    ),
    rejected(
      "Claude retains a received script when its allowance is spent",
      [Backend.Claude, 0],
      true,
    ),
  ],
};

export const nativeReconciliationCases = {
  positive: [
    positive(
      "Codex reconciles a received result after server restart",
      [Backend.Codex, 1, false, false],
      true,
    ),
    positive(
      "Claude reconciles a received result after server restart",
      [Backend.Claude, 1, false, false],
      true,
    ),
    positive(
      "Codex reconciles a sealed receipt against an external edit",
      [Backend.Codex, 1, true, false],
      true,
    ),
    positive(
      "Claude reconciles a sealed receipt against an external edit",
      [Backend.Claude, 1, true, false],
      true,
    ),
    positive(
      "Codex reconciles a completed worker after server restart",
      [Backend.Codex, 1, true, true],
      true,
    ),
    positive(
      "Claude reconciles a completed worker after server restart",
      [Backend.Claude, 1, true, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "Codex cannot reconcile with a spent allowance",
      [Backend.Codex, 0, false, false],
      true,
    ),
    rejected(
      "Claude cannot reconcile with a spent allowance",
      [Backend.Claude, 0, false, false],
      true,
    ),
    rejected(
      "Codex retains a sealed receipt when its allowance is spent",
      [Backend.Codex, 0, true, false],
      true,
    ),
    rejected(
      "Claude retains a sealed receipt when its allowance is spent",
      [Backend.Claude, 0, true, false],
      true,
    ),
    rejected(
      "Codex retains a completed worker when its allowance is spent",
      [Backend.Codex, 0, true, true],
      true,
    ),
    rejected(
      "Claude retains a completed worker when its allowance is spent",
      [Backend.Claude, 0, true, true],
      true,
    ),
  ],
};

export const nativeSplitReconciliationCases = {
  positive: [
    positive("Codex retains both native split receipts after restart", [Backend.Codex, 1], true),
    positive("Claude retains both native split receipts after restart", [Backend.Claude, 1], true),
  ],
  negative: [
    rejected("Codex split recovery cannot exceed its allowance", [Backend.Codex, 0], true),
    rejected("Claude split recovery cannot exceed its allowance", [Backend.Claude, 0], true),
  ],
};
