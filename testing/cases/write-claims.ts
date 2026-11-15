import { positive, rejected } from "@titan/test-factories";

export const writeClaimParentCases = {
  positive: [
    positive("child then parent expansion retains separate input baselines", [false, false], true),
    positive(
      "parent expansion preserves baselines through two engine restarts",
      [false, true],
      true,
    ),
  ],
  negative: [
    rejected("parent refutation restores the original child and peer", [true, false], true),
    rejected("restarted parent refutation preserves the first child baseline", [true, true], true),
  ],
};

export const writeClaimServerCases = {
  positive: [
    positive("production HTTP approval expands the worker's live scope", [true, false], true),
    positive("production HTTP approval survives daemon restart", [true, true], true),
  ],
  negative: [
    rejected("production HTTP denial preserves an unlisted file", [false, false], true),
    rejected("production HTTP denial survives daemon restart", [false, true], true),
  ],
};

export const writeClaimPersistenceCases = {
  positive: [
    positive(
      "stable write intent and baseline replay without changing caller identity",
      ["stable"],
      true,
    ),
    positive("an already declared write path requires no revision", ["own"], true),
  ],
  negative: [
    rejected("failed intent append restores the earlier format and paths", ["commit"], true),
    rejected("failed baseline append permits a clean admission retry", ["input"], true),
    rejected("released owners cannot expand write scope", ["released"], true),
    rejected("checkers cannot expand write scope", ["checker"], true),
    rejected("write scope cannot exceed its bounded allowance", ["capacity"], true),
    rejected("write expansion cannot include runtime-owned paths", ["runtime"], true),
    rejected("write expansion refuses extra operation arguments", ["arguments"], true),
    rejected("an older journal cannot contain expanded write state", ["legacy"], true),
    rejected("a baseline cannot name an arbitrary input path", ["path"], true),
    rejected("a baseline cannot name a future reconciliation generation", ["generation"], true),
    rejected("baseline state requires retained write intent", ["missing-paths"], true),
  ],
};

export const writeClaimNegotiationCases = {
  positive: [
    positive(
      "an expanded writer captures peer edits after releasing its earlier scope",
      [false, false],
      true,
    ),
    positive("an expanded child writer waits for its active parent", [true, false], true),
  ],
  negative: [
    rejected("cancelled expansion withdraws without capturing or dispatching", [false, true], true),
    rejected("cancelled child expansion preserves its active parent", [true, true], true),
  ],
};

export const writeClaimGrantCases = {
  positive: [
    positive("approved existing file joins the live claim", ["existing", false], true),
    positive("approved new file joins the live claim after restart", ["new", true], true),
    positive(
      "expanded scope retains its newer format through reconciliation",
      ["reconcile", false],
      true,
    ),
    positive(
      "restarted reconciliation retains the expanded scope and original baseline",
      ["reconcile", true],
      true,
    ),
  ],
  negative: [
    rejected("denied existing file keeps its external contents", ["deny-existing", false], true),
    rejected("denied new file remains absent after restart", ["deny-new", true], true),
    rejected("approved protected path is refused before dispatch", ["protected", false], true),
    rejected("approved parent traversal is refused after restart", ["traversal", true], true),
    rejected("refutation restores the newly admitted file baseline", ["refuted", false], true),
    rejected("refutation restores the expanded baseline after restart", ["refuted", true], true),
    rejected("altered retained write input prevents publication", ["tamper", false], true),
    rejected("restarted writes cannot publish against an altered baseline", ["tamper", true], true),
    rejected(
      "reconciled refutation preserves the intervening external edit",
      ["reconcile-refuted", false],
      true,
    ),
    rejected(
      "restarted reconciled refutation preserves newer external contents",
      ["reconcile-refuted", true],
      true,
    ),
  ],
};
