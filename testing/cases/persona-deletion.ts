import { positive, rejected } from "@titan/test-factories";

export const personaDeletionHistoryCases = {
  positive: [
    positive("archived history publication replays its journal", ["journal-before"], true),
    positive(
      "a published archive journal replays without another version",
      ["journal-after"],
      true,
    ),
    positive("a frozen run retains quality and usage after persona deletion", ["late"], true),
    positive("archived persona history continues across owner restart", ["restart"], true),
  ],
  negative: [
    rejected("an archive journal cannot restore a live persona state", ["journal-state"], true),
    rejected("an archive journal refuses changed retained content", ["journal-conflict"], true),
    rejected("an archive journal refuses a conflicting current file", ["journal-current"], true),
    rejected("unexpected archive names refuse history", ["filename"], true),
    rejected("an empty archive refuses history", ["empty"], true),
    rejected("a changed archived state refuses history", ["state"], true),
    rejected("a changed archived version refuses history", ["version"], true),
    rejected("a linked archive directory refuses history", ["linked"], true),
  ],
};
