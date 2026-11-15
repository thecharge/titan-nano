import { KnowledgeKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeProjectKnowledgeCases = {
  positive: [
    positive(
      "private project facts publish through a recreated owner",
      [KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "private project lessons publish through a recreated owner",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "discarded project facts cannot leak into final or home reads",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "discarded project lessons cannot leak into final or home reads",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
export const nativeProjectLegacyCases = {
  positive: [
    positive(
      "legacy home fact attempts retain their publication owner",
      [KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "legacy home lesson attempts retain their publication owner",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "duplicate fact attempt scopes refuse ambiguous ownership",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "duplicate lesson attempt scopes refuse ambiguous ownership",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
