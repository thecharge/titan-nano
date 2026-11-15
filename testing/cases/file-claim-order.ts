import { positive, rejected } from "@titan/test-factories";

export const reconciliationClaimCases = {
  positive: [
    positive("a script retains write admission with a writable reconciler", [true, true], true),
    positive("a script retains write admission with a read-only reconciler", [false, true], true),
  ],
  negative: [
    rejected("a read-only original worker cannot hide a writable reconciler", [true, false], true),
    rejected("read-only reconciliation does not acquire write permission", [false, false], true),
  ],
};

export const fileClaimBindingCases = {
  positive: [
    positive("new binding retains its execution", [false, false], true),
    positive("replacement binding retains its new execution", [true, false], true),
  ],
  negative: [
    rejected("failed first binding restores its absent claim", [false, true], true),
    rejected("failed replacement restores the previous claim and execution", [true, true], true),
  ],
};

export const fileClaimCapacityCases = {
  positive: [
    positive("two waiting file claims fit their queue allowance", [false, false], true),
    positive("two waiting nested claims fit their queue allowance", [true, false], true),
  ],
  negative: [
    rejected("excess file claimant never dispatches", [false, true], true),
    rejected("excess nested claimant never dispatches", [true, true], true),
  ],
};

export const fileClaimOrderingCases = {
  positive: [
    positive("slow path resolution cannot reorder same-file intent", [false, false], true),
    positive("slow path resolution cannot reorder nested-file intent", [true, false], true),
  ],
  negative: [
    rejected("cancelled unresolved file intent cannot start work", [false, true], true),
    rejected("cancelled unresolved folder intent cannot strand its peer", [true, true], true),
  ],
};
