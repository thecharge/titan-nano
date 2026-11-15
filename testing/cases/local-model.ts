import { EmbedderName, LocalModelEmbedderName } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const modelCacheCases = {
  positive: [
    positive("installed files are reused without fetching", ["ready"], true),
    positive("corrupt pinned contents are repaired", ["repair"], true),
  ],
  negative: [
    rejected("short downloads cannot publish", ["short"], true),
    rejected("oversized downloads cannot publish", ["long"], true),
    rejected("wrong digests cannot publish", ["digest"], true),
    rejected("HTTP failure cannot publish", ["http"], true),
    rejected("missing bodies cannot publish", ["body"], true),
    rejected("cache parent links cannot redirect writes", ["parent"], true),
    rejected("cache leaf links cannot redirect writes", ["leaf"], true),
  ],
};
export const homeModelCases = {
  positive: [
    positive("installed model initializes once", ["ready"], true),
    positive("missing model can be installed then retried", ["missing"], true),
  ],
  negative: [
    rejected("loader failure can retry initialization", ["loader"], true),
    rejected("pipeline failure can retry initialization", ["pipeline"], true),
  ],
};
export const modelSelectionCases = {
  positive: [
    positive(
      "built-in alias selects pinned identity",
      [EmbedderName.Local, true],
      LocalModelEmbedderName,
    ),
    positive("default selects pinned identity", [undefined, true], LocalModelEmbedderName),
  ],
  negative: [
    rejected("custom configured name is never substituted", ["custom", true], "custom"),
    rejected(
      "legacy injected embedder retains its identity",
      [EmbedderName.Local, false],
      EmbedderName.Local,
    ),
  ],
};

export const modelCommandCases = {
  positive: [
    positive("install announces then fetches missing model", ["install", false, true], true),
    positive("doctor explicitly fetches missing model", ["doctor", false, true], true),
    positive("ready install avoids another fetch", ["install", true, true], true),
  ],
  negative: [
    rejected("no-model install never fetches", ["install", false, false], true),
    rejected("offline doctor never fetches missing model", ["doctor", false, false], true),
    rejected("ready doctor never fetches again", ["doctor", true, true], true),
  ],
};

export const modelReadinessCases = {
  positive: [
    positive("verified model reports meaning ready", ["ready"], true),
    positive("explicit reindex keeps ready model ready", ["reindexed"], true),
  ],
  negative: [
    rejected("missing model reports not ready", ["missing"], true),
    rejected("corrupt model reports not ready", ["corrupt"], true),
    rejected("changed model requires reindex", ["changed"], true),
    rejected("unavailable configured adapter reports not ready", ["unavailable"], true),
  ],
};
