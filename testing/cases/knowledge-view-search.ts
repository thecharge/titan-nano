import { KnowledgeKind, KnowledgeSearchMode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeViewSearchOwnCases = {
  positive: [
    positive("fact owner sees pending changes and final peers", [KnowledgeKind.Fact, false], true),
    positive(
      "lesson owner sees pending changes and final peers",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "private fact words cannot leak to another candidate",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "private lesson words cannot leak to another candidate",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
export const knowledgeViewSearchPageCases = {
  positive: [
    positive("deleted facts do not consume final page slots", [KnowledgeKind.Fact, false], true),
    positive(
      "deleted lessons do not consume final page slots",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected("combined fact page cannot exceed its limit", [KnowledgeKind.Fact, true], true),
    rejected("combined lesson page cannot exceed its limit", [KnowledgeKind.Lesson, true], true),
  ],
};
export const knowledgeViewSearchTerminalCases = {
  positive: [
    positive("published fact view reads only final search", [KnowledgeKind.Fact, false], true),
    positive("published lesson view reads only final search", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("discarded fact cannot appear in private search", [KnowledgeKind.Fact, true], true),
    rejected(
      "discarded lesson cannot appear in private search",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
export const knowledgeViewSearchGuardCases = {
  positive: [
    positive(
      "private word search stays available",
      [KnowledgeKind.Fact, KnowledgeSearchMode.Words, false],
      true,
    ),
    positive(
      "private both search reports its word fallback",
      [KnowledgeKind.Lesson, KnowledgeSearchMode.Both, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "private meaning search cannot pretend to work",
      [KnowledgeKind.Fact, KnowledgeSearchMode.Meaning, false],
      true,
    ),
    rejected(
      "invalid private query cannot damage later searches",
      [KnowledgeKind.Lesson, KnowledgeSearchMode.Words, true],
      true,
    ),
  ],
};

export const knowledgeViewSearchQueueCases = {
  positive: [
    positive("queued fact search retains one private revision", [KnowledgeKind.Fact, false], true),
    positive(
      "queued lesson search retains one private revision",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "failed fact publication fences queued search and edit",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "failed lesson publication fences queued search and edit",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};

export const knowledgeViewSearchBudgetCases = {
  positive: [
    positive("two final entries and one private result fit", [2, false], true),
    positive("four final entries and one private result fit", [4, false], true),
  ],
  negative: [
    rejected("expanded private page cannot exceed byte budget", [180, true], true),
    rejected("maximum private page cannot exceed byte budget", [200, true], true),
  ],
};
