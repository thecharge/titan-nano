import {
  ErrorCode,
  KnowledgeMeaningFixture as Fixture,
  KnowledgeKind,
  KnowledgeSearchMode as Mode,
  KnowledgeMeaningSetup as Setup,
} from "@titan/constants";
import { KnowledgeMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const found = { count: 1, first: true, score: 1, actual_mode: Mode.Meaning, warning: null };
const blended = { ...found, actual_mode: Mode.Both };
const wordsOnly = { ...found, score: null, actual_mode: Mode.Words };
const fellBack = { ...wordsOnly, warning: KnowledgeMessage.MeaningUnavailable };
const empty = { count: 0, first: false, score: null, actual_mode: Mode.Meaning, warning: null };
const emptyBlend = { ...empty, actual_mode: Mode.Both };
const emptyWords = { ...empty, actual_mode: Mode.Words };
const notBuilt = { code: ErrorCode.NotBuilt };

export const knowledgeMeaningCases = {
  positive: [
    positive(
      "meaning mode finds the lesson with no shared word",
      [Mode.Meaning, Fixture.Related, Setup.Ready],
      found,
    ),
    positive(
      "both mode finds the lesson with no shared word",
      [Mode.Both, Fixture.Related, Setup.Ready],
      blended,
    ),
    positive(
      "both mode gives a word match its meaning score",
      [Mode.Both, Fixture.Words, Setup.Ready],
      blended,
    ),
    positive("meaning mode follows an update", [Mode.Meaning, Fixture.Food, Setup.Updated], found),
    positive(
      "meaning mode ignores an index hit with no entry",
      [Mode.Meaning, Fixture.Related, Setup.Ghost],
      found,
    ),
    positive(
      "words mode works without the vector parts",
      [Mode.Words, Fixture.Words, Setup.Unloadable],
      wordsOnly,
    ),
    positive(
      "default mode prints that meaning search is not ready",
      [Mode.Both, Fixture.Words, Setup.Unloadable],
      fellBack,
    ),
    positive(
      "default mode falls back when the embedder fails",
      [Mode.Both, Fixture.Words, Setup.BrokenEmbedder],
      fellBack,
    ),
    positive(
      "words mode leaves the vector parts alone",
      [Mode.Words, Fixture.Words, Setup.Ready],
      wordsOnly,
    ),
  ],
  negative: [
    negative(
      "meaning mode is not built when the vector parts do not load",
      [Mode.Meaning, Fixture.Related, Setup.Unloadable],
      notBuilt,
    ),
    negative(
      "meaning mode is not built when the embedder fails",
      [Mode.Meaning, Fixture.Related, Setup.BrokenEmbedder],
      notBuilt,
    ),
    rejected(
      "words mode misses the question that shares no word",
      [Mode.Words, Fixture.Related, Setup.Ready],
      emptyWords,
    ),
    rejected(
      "meaning mode leaves out an unrelated question",
      [Mode.Meaning, Fixture.Food, Setup.Ready],
      empty,
    ),
    rejected(
      "both mode leaves out an unrelated question",
      [Mode.Both, Fixture.Food, Setup.Ready],
      emptyBlend,
    ),
    rejected(
      "meaning mode drops the old meaning after an update",
      [Mode.Meaning, Fixture.Related, Setup.Updated],
      empty,
    ),
    rejected(
      "meaning mode drops a deleted entry",
      [Mode.Meaning, Fixture.Related, Setup.Deleted],
      empty,
    ),
    rejected(
      "meaning mode keeps the kind filter",
      [Mode.Meaning, Fixture.Related, Setup.Ready, KnowledgeKind.Fact],
      empty,
    ),
  ],
};
