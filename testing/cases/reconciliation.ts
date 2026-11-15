import { RequestDecision } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const splitReconciliationCases = {
  positive: [
    positive("a declared persona merges received parts without replay", ["recover", false], true),
    positive("nested split recovery retains the original aggregate", ["recover", true], true),
  ],
  negative: [
    rejected(
      "a split without a reconciliation persona retains its parts",
      ["missing", false],
      true,
    ),
    rejected("a split with a spent recovery budget starts no merger", ["budget", false], true),
    rejected("a refuted split merger restores its current input", ["refuted", false], true),
  ],
};

export const scriptReconciliationCases = {
  positive: [
    positive(
      "a declared persona merges a received script without replay",
      ["recover", false],
      true,
    ),
    positive("nested script recovery retains the original command output", ["recover", true], true),
  ],
  negative: [
    rejected("a script without a reconciliation persona stays received", ["missing", false], true),
    rejected("a spent recovery budget starts no reconciliation persona", ["budget", true], true),
    rejected("refuted script reconciliation restores the external input", ["refuted", false], true),
  ],
};

export const reconciliationRecoveryCases = {
  positive: [
    positive(
      "received work reconciles once with fresh checks in the shared project",
      ["recover", false],
      true,
    ),
    positive("reconciliation admission survives a controller restart", ["resume", true], true),
  ],
  negative: [
    rejected(
      "a second generation survives lost projection without losing its earlier receipt",
      ["repeat-commit-failure", false],
      true,
    ),
    rejected(
      "nested repeated reconciliation counts physical work across generations",
      ["repeat-commit-failure", true],
      true,
    ),
    rejected(
      "a lost reconciliation projection recovers its durable generation without worker replay",
      ["commit-failure", false],
      true,
    ),
    rejected(
      "a nested project recovers after reconciliation projection failure",
      ["commit-failure", true],
      true,
    ),
    rejected("refuted reconciliation retains an unchanged external edit", ["refuted", false], true),
    rejected(
      "refuted reconciliation restores its own edit to the current generation input",
      ["refuted-edit", true],
      true,
    ),
    rejected(
      "a spent recovery budget retains the received result without dispatch",
      ["budget", false],
      true,
    ),
    rejected(
      "changed reconciliation input blocks before another vendor turn",
      ["changed-input", true],
      true,
    ),
  ],
};

export const reconciliationKnowledgeCases = {
  positive: [
    positive("fresh checked knowledge publishes from its own generation", [true, false], true),
    positive("nested project recovery retains the earlier private proposal", [true, true], true),
  ],
  negative: [
    rejected("refuted recovery cannot publish either generation proposal", [false, false], true),
    rejected("nested refuted recovery retains the external edit", [false, true], true),
  ],
};

export const reconciliationRefusalCases = {
  positive: [
    positive(
      "approved script-check refusal retains its original evidence",
      [false, RequestDecision.Approve, false],
      true,
    ),
    positive(
      "approved script falsifier refusal preserves external edits",
      [true, RequestDecision.Approve, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "denied script-check restoration cannot dispatch reconciliation",
      [false, RequestDecision.Deny, false],
      true,
    ),
    rejected(
      "changed external files invalidate a script falsifier restoration approval",
      [true, RequestDecision.Approve, true],
      true,
    ),
  ],
};
