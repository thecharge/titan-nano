import { positive, rejected } from "@titan/test-factories";

export const readClaimRevisionCases = {
  positive: [
    positive("missing-file dependencies survive release and restart", ["file"], true),
    positive("directory dependencies cover their observed children", ["parent"], true),
    positive("a whole-tree listing replaces narrower read claims", ["root"], true),
    positive("an existing write scope already covers its read", ["own"], true),
    positive("legacy isolated execution keeps its existing claim behavior", ["isolated"], true),
  ],
  negative: [
    rejected(
      "an older journal rejects new node read intent on first append",
      ["legacy-node"],
      true,
    ),
    rejected(
      "an older journal rejects an embedded read claim on first append",
      ["legacy-phase"],
      true,
    ),
    rejected("failed durable intent restores earlier read paths", ["commit-failure"], true),
    rejected("excess dependency claims refuse the revision", ["capacity"], true),
    rejected("a released owner cannot revise a live claim", ["released"], true),
  ],
};

export const readClaimNegotiationCases = {
  positive: [
    positive(
      "a reader releases its write claim before waiting for a dependency",
      [false, false],
      true,
    ),
    positive("a dependency child waits for its active parent writer", [true, false], true),
  ],
  negative: [
    rejected("cancelling a dependency wait withdraws its complete claim", [false, true], true),
    rejected("cancelling a child wait preserves the active parent", [true, true], true),
  ],
};

export const readClaimPersistenceCases = {
  positive: [
    positive("concurrent file intents retain both durable revisions", [false, false], true),
    positive("concurrent nested intents retain both durable revisions", [true, false], true),
  ],
  negative: [
    rejected("failed file intent preserves its peer's newer format", [false, true], true),
    rejected("failed nested intent preserves its peer's newer format", [true, true], true),
  ],
};
