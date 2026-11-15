import {
  ErrorCode,
  KnowledgeScope,
  KnowledgeScopeFixture,
  KnowledgeScopeLookup,
  KnowledgeScopeSeed,
} from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

function label(scope: KnowledgeScope, title: string): string {
  return `${scope}${KnowledgeScopeFixture.Joiner}${title}`;
}

const utc = label(KnowledgeScope.Project, KnowledgeScopeFixture.UtcTitle);
const zones = label(KnowledgeScope.Home, KnowledgeScopeFixture.ZoneTitle);

export const scopedSearchCases = {
  positive: [
    positive(
      "a UTC fact in the project and a time zones fact at home are both found and each names its scope",
      [KnowledgeScopeSeed.Both, KnowledgeScopeFixture.Question],
      [utc, zones].join(KnowledgeScopeFixture.Rows),
    ),
    positive(
      "a fact only at home is found and named home",
      [KnowledgeScopeSeed.HomeOnly, KnowledgeScopeFixture.Question],
      zones,
    ),
    positive(
      "the same id in both hubs is listed once, from the project",
      [KnowledgeScopeSeed.Shared, KnowledgeScopeFixture.Question],
      utc,
    ),
  ],
  negative: [
    rejected(
      "a word no fact has finds nothing in either hub",
      [KnowledgeScopeSeed.Both, KnowledgeScopeFixture.Missing],
      KnowledgeScopeFixture.Nothing,
    ),
    rejected(
      "two empty hubs find nothing",
      [KnowledgeScopeSeed.Neither, KnowledgeScopeFixture.Question],
      KnowledgeScopeFixture.Nothing,
    ),
  ],
};

export const scopedLookupCases = {
  positive: [
    positive(
      "get finds a project entry and names the project",
      [KnowledgeScopeLookup.Project],
      utc,
    ),
    positive("get falls back to the home hub and names home", [KnowledgeScopeLookup.Home], zones),
    positive(
      "list shows both hubs with the scope of each",
      [KnowledgeScopeLookup.List],
      [[utc, zones].join(KnowledgeScopeFixture.Rows), KnowledgeScopeFixture.Complete].join(
        KnowledgeScopeFixture.Rows,
      ),
    ),
  ],
  negative: [
    rejected(
      "get of an id in neither hub is a missing entry",
      [KnowledgeScopeLookup.Missing],
      ErrorCode.KnowledgeMissing,
    ),
    rejected(
      "list with a limit of one stops after one entry and says it is truncated",
      [KnowledgeScopeLookup.Limited],
      [utc, KnowledgeScopeFixture.Truncated].join(KnowledgeScopeFixture.Rows),
    ),
  ],
};

export const scopedCloneCases = {
  positive: [
    positive(
      "a clone that has the project knowledge folder finds the project fact",
      [true, KnowledgeScopeFixture.UtcQuestion],
      utc,
    ),
    positive(
      "the cloned project fact is also found by a word from its text",
      [true, KnowledgeScopeFixture.Question],
      utc,
    ),
  ],
  negative: [
    rejected(
      "a clone without the project knowledge folder finds nothing",
      [false, KnowledgeScopeFixture.UtcQuestion],
      KnowledgeScopeFixture.Nothing,
    ),
    rejected(
      "a clone with the folder finds nothing for a word no fact has",
      [true, KnowledgeScopeFixture.Missing],
      KnowledgeScopeFixture.Nothing,
    ),
  ],
};

export const scopedOpenCases = {
  positive: [
    positive(
      "both hubs open when the home folder can be made",
      [false],
      KnowledgeScopeFixture.Opened,
    ),
    positive(
      "a project folder that does not exist yet is created and both hubs close cleanly",
      [false],
      KnowledgeScopeFixture.Opened,
    ),
  ],
  negative: [
    rejected(
      "a home folder under a plain file is refused and the project hub is released",
      [true],
      `${KnowledgeScopeFixture.Refused}${KnowledgeScopeFixture.Joiner}${KnowledgeScopeFixture.Reopened}`,
    ),
    rejected(
      "the refusal leaves the project hub usable again",
      [true],
      `${KnowledgeScopeFixture.Refused}${KnowledgeScopeFixture.Joiner}${KnowledgeScopeFixture.Reopened}`,
    ),
  ],
};
