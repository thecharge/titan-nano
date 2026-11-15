import { KnowledgeKind, KnowledgeViewFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeViewCycleCases = {
  positive: [
    positive("owner reads its fact across restart", [KnowledgeKind.Fact, false], true),
    positive("owner reads its lesson across restart", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("discarded fact cannot return through owner view", [KnowledgeKind.Fact, true], true),
    rejected(
      "discarded lesson cannot return through owner view",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
export const knowledgeViewEditCases = {
  positive: [
    positive("repeated fact edits retain one final version", [KnowledgeKind.Fact, false], true),
    positive("repeated lesson edits retain one final version", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("stale fact cannot overwrite peer publication", [KnowledgeKind.Fact, true], true),
    rejected("stale lesson cannot overwrite peer publication", [KnowledgeKind.Lesson, true], true),
  ],
};
export const knowledgeViewDeleteCases = {
  positive: [
    positive(
      "final fact deletion stays private until publication",
      [KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "final lesson deletion stays private until publication",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "cancelled private fact addition cannot become final",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "cancelled private lesson addition cannot become final",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
export const knowledgeViewGuardCases = {
  positive: [
    positive(
      "fact edit accepts current private revision",
      [KnowledgeKind.Fact, KnowledgeViewFixture.Observed],
      true,
    ),
    positive(
      "lesson edit accepts current private revision",
      [KnowledgeKind.Lesson, KnowledgeViewFixture.Observed],
      true,
    ),
  ],
  negative: [
    rejected(
      "stale private revision refuses fact edit and deletion",
      [KnowledgeKind.Fact, KnowledgeViewFixture.Revision],
      true,
    ),
    rejected(
      "stale entry version refuses lesson edit and deletion",
      [KnowledgeKind.Lesson, KnowledgeViewFixture.Version],
      true,
    ),
    rejected("entry kind cannot change", [KnowledgeKind.Fact, KnowledgeViewFixture.Kind], true),
    rejected(
      "persona deletion requires approval",
      [KnowledgeKind.Lesson, KnowledgeViewFixture.Persona],
      true,
    ),
    rejected(
      "invalid private mutations cannot be staged",
      [KnowledgeKind.Fact, KnowledgeViewFixture.Invalid],
      true,
    ),
    rejected(
      "duplicate final and pending ids are refused",
      [KnowledgeKind.Lesson, KnowledgeViewFixture.Duplicate],
      true,
    ),
    rejected(
      "private add and update respect entry bytes",
      [KnowledgeKind.Fact, KnowledgeViewFixture.Bytes],
      true,
    ),
    rejected(
      "unavailable final owner does not look absent",
      [KnowledgeKind.Lesson, KnowledgeViewFixture.Unavailable],
      true,
    ),
  ],
};

export const knowledgeViewRaceCases = {
  positive: [
    positive("separate fact attempts can edit concurrently", [KnowledgeKind.Fact, false], true),
    positive("separate lesson attempts can edit concurrently", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected(
      "same fact revision cannot accept both concurrent writes",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "same lesson revision cannot accept both concurrent writes",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};

export const knowledgeViewScopeCases = {
  positive: [
    positive("fact view retains its copied scope", [KnowledgeKind.Fact, false], true),
    positive("lesson view retains its copied scope", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected("invalid fact scope is refused before use", [KnowledgeKind.Fact, true], true),
    rejected("invalid lesson scope is refused before use", [KnowledgeKind.Lesson, true], true),
  ],
};
