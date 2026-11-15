import { KnowledgeKind, KnowledgeScope } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const retainedKnowledgeHistoryCases = {
  positive: [
    positive(
      "Markdown versions page without changing read accounting",
      [KnowledgeKind.Fact, "page"],
      true,
    ),
    positive(
      "persona YAML versions retain exact historical content",
      [KnowledgeKind.Persona, "page"],
      true,
    ),
    positive("a first version has no retained history", [KnowledgeKind.Lesson, "empty"], true),
    positive("history responses stop at their byte budget", [KnowledgeKind.Fact, "bytes"], true),
  ],
  negative: [
    rejected("a missing retained version is refused", [KnowledgeKind.Fact, "missing"], true),
    rejected("malformed historical content is refused", [KnowledgeKind.Lesson, "malformed"], true),
    rejected("a retained foreign identity is refused", [KnowledgeKind.Fact, "identity"], true),
    rejected("a retained foreign kind is refused", [KnowledgeKind.Lesson, "kind"], true),
    rejected("a changed historical version is refused", [KnowledgeKind.Fact, "version"], true),
    rejected("a linked version is refused", [KnowledgeKind.Lesson, "link"], true),
    rejected("a shared historical inode is refused", [KnowledgeKind.Fact, "hard-link"], true),
    rejected("a linked historical parent is refused", [KnowledgeKind.Lesson, "parent-link"], true),
    rejected("a linked history root is refused", [KnowledgeKind.Fact, "root-link"], true),
    rejected(
      "a cursor beyond the current version is refused",
      [KnowledgeKind.Fact, "cursor"],
      true,
    ),
  ],
};

export const knowledgeHistoryReplyCases = {
  positive: [
    positive("a bounded history page retains its cursor", ["page"], true),
    positive("the oldest retained version closes pagination", ["last"], true),
  ],
  negative: [
    rejected("a foreign history identity is refused", ["identity"], true),
    rejected("a skipped history version is refused", ["order"], true),
    rejected("a crossed history kind is refused", ["kind"], true),
    rejected("a repeated history cursor is refused", ["cursor"], true),
    rejected("an empty unfinished history page is refused", ["empty"], true),
    rejected("a malformed history response is refused", ["malformed"], true),
    rejected("an oversized serialized history response is refused", ["bytes"], true),
    rejected("an invalid history selector is refused", ["invalid"], true),
  ],
};

export const knowledgeKindDatesCases = {
  positive: [
    positive("ordinary statistics distinguish kind date ranges", [false, false], true),
    positive("inspection statistics retain independent kind dates", [true, true], true),
  ],
  negative: [
    rejected("reversed rows cannot substitute another kind's date", [true, false], true),
    rejected("repeated inspection cannot retain stale kind dates", [false, true], true),
  ],
};

export const knowledgeHistorySurfaceCases = {
  positive: [
    positive(
      "project history is retained through CLI and dashboard inspection",
      [KnowledgeScope.Project, false],
      true,
    ),
    positive(
      "home history is retained through HTTP, CLI and dashboard inspection",
      [KnowledgeScope.Home, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "project history rejects future version cursors on actual surfaces",
      [KnowledgeScope.Project, true],
      true,
    ),
    rejected(
      "home history rejects future version cursors on actual surfaces",
      [KnowledgeScope.Home, true],
      true,
    ),
  ],
};

export const retainedHistoryFramingCases = {
  positive: [
    positive("a history array exactly fills its byte budget", [-10, false], true),
    positive("an inspected history array fits below its byte budget", [-11, true], true),
  ],
  negative: [
    rejected("array punctuation cannot exceed the owner history budget", [0, false], true),
    rejected("a one-byte history overflow leaves an explicit continuation", [-9, true], true),
  ],
};
