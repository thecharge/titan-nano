import { positive, rejected } from "@titan/test-factories";

export const updateBackupCases = {
  positive: [
    positive(
      "whole home and project metadata preserve credentials, modes, links and earlier backups",
      ["whole"],
      true,
    ),
    positive("nested and duplicate roots retain one verified copy", ["nested"], true),
    positive("a home inside project metadata has a finite verified backup", ["enclosed"], true),
    positive("a deeply nested home has a finite verified backup", ["deeply-enclosed"], true),
  ],
  negative: [
    rejected("concurrent source edits refuse publication", ["changed"], true),
    rejected("changed and restored bytes retain their changed identity", ["changed-back"], true),
    rejected(
      "an edit after per-root verification refuses publication",
      ["changed-after-verification"],
      true,
    ),
    rejected("symbolic link roots refuse publication", ["linked-root"], true),
    rejected("damaged backup fails verification", ["damaged"], true),
    rejected(
      "a manifest without the home as its first copy is refused",
      ["wrong-first-root"],
      true,
    ),
    rejected("duplicate manifest destinations are refused", ["duplicate-copy"], true),
    rejected("a linked copied root is refused without changing its target", ["linked-copy"], true),
  ],
};

export const updateBackupJournalCases = {
  positive: [
    positive("a copied journal validates against its retained original paths", ["single"], true),
    positive("a copied event sequence retains original run identity", ["events"], true),
    positive(
      "an earlier creating runtime remains valid for read-only backup inspection",
      ["older"],
      true,
    ),
    positive("a catalog retains runs created by different releases", ["mixed"], true),
  ],
  negative: [
    rejected("an empty journal copy is refused", ["empty"], true),
    rejected("a changed runtime pin inside retained history is refused", ["changed-runtime"], true),
    rejected("an unsupported data format is refused during backup", ["future-format"], true),
    rejected("a copy with an incompatible creating runtime is refused", ["runtime"], true),
    rejected("a journal outside the manifest mappings is refused", ["missing-root"], true),
    rejected("a linked catalog cannot mutate its external target", ["linked-catalog"], true),
    rejected(
      "a linked catalog companion cannot mutate its external target",
      ["linked-catalog-companion"],
      true,
    ),
  ],
};
