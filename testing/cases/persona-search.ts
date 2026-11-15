import { KnowledgeSearchMode, PersonaSearchFixture, PersonaState } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const fixture = PersonaSearchFixture;

export const personaPrivateVisibilityCases = {
  positive: [
    positive(
      "private all search retains retired evidence across restart and publication",
      [PersonaState.Retired, true],
      true,
    ),
    positive(
      "private all search retains deleted evidence across restart and publication",
      [PersonaState.Deleted, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "private search hides retired proposals and final records",
      [PersonaState.Retired, false],
      true,
    ),
    rejected(
      "private search hides deleted proposals and final records",
      [PersonaState.Deleted, false],
      true,
    ),
  ],
};

export const personaVisibilityCliCases = {
  positive: [
    positive("CLI all search includes retired personas", [PersonaState.Retired, true, false], true),
    positive(
      "CLI all search includes deleted personas after daemon restart",
      [PersonaState.Deleted, true, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "ordinary CLI search hides retired personas after daemon restart",
      [PersonaState.Retired, false, true],
      true,
    ),
    rejected(
      "ordinary CLI search hides deleted personas",
      [PersonaState.Deleted, false, false],
      true,
    ),
  ],
};

export const personaVisibilityCases = {
  positive: [
    positive(
      "retired personas remain inspectable through an explicit all search",
      [PersonaState.Retired, KnowledgeSearchMode.Words, false],
      true,
    ),
    positive(
      "deleted personas remain inspectable after reopening the hub",
      [PersonaState.Deleted, KnowledgeSearchMode.Words, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "meaning search excludes retired personas before applying its limit",
      [PersonaState.Retired, KnowledgeSearchMode.Meaning, false],
      true,
    ),
    rejected(
      "meaning search excludes deleted personas after restart and all inspection",
      [PersonaState.Deleted, KnowledgeSearchMode.Meaning, true],
      true,
    ),
    rejected(
      "combined search excludes retired personas before applying its limit",
      [PersonaState.Retired, KnowledgeSearchMode.Both, true],
      true,
    ),
    rejected(
      "combined search excludes deleted personas across query changes",
      [PersonaState.Deleted, KnowledgeSearchMode.Both, false],
      true,
    ),
  ],
};

export const personaSearchCases = {
  positive: [
    positive(
      "persona-registry > Find a skeptic: skeptic@5 comes first with its state and history counts",
      [fixture.Prove, 4, fixture.Described],
      "skeptic 5 proven 8 2",
    ),
    positive(
      "persona-registry > Find a skeptic: a new skeptic without history counts starts as proposed",
      [fixture.Prove, 0, fixture.Plain],
      "skeptic 1 proposed 0 0",
    ),
  ],
  negative: [
    rejected(
      "persona-registry > Find a skeptic: a question that matches no description finds nothing",
      [fixture.Unrelated, 4, fixture.Described],
      "none",
    ),
    rejected(
      "persona-registry > Find a skeptic: a description that is not a record gives no history counts",
      [fixture.Prove, 0, fixture.PlainText],
      "skeptic 1 proposed 0 0",
    ),
    rejected(
      "persona-registry > Find a skeptic: an unknown state is not trusted",
      [fixture.Prove, 0, fixture.Unknown],
      "skeptic 1 proposed 0 0",
    ),
  ],
};
