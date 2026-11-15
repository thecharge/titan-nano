import {
  EmbedderFixture,
  ErrorCode,
  KnowledgeKind,
  KnowledgeSearchMode as Mode,
  Newline,
  VectorHubSetup as Setup,
} from "@titan/constants";
import { KnowledgeMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const question = EmbedderFixture.Title + Newline + EmbedderFixture.Body;
const found = { count: 1, first: true, score: 1, actual_mode: Mode.Meaning, warning: null };
const blended = { ...found, actual_mode: Mode.Both };
const wordsOnly = { ...found, score: null, actual_mode: Mode.Words };
const fellBack = { ...wordsOnly, warning: KnowledgeMessage.MeaningUnavailable };
const empty = { ...found, count: 0, first: false, score: null };

export const vectorHubCases = {
  positive: [
    positive(
      "meaning mode finds the entry through the sqlite-vec index",
      [Mode.Meaning, question, Setup.Ready],
      found,
    ),
    positive(
      "both mode scores the entry through the sqlite-vec index",
      [Mode.Both, question, Setup.Ready],
      blended,
    ),
    positive(
      "words mode works when the vector file cannot open",
      [Mode.Words, EmbedderFixture.Words, Setup.Blocked],
      wordsOnly,
    ),
    positive(
      "default mode prints that meaning search is not ready",
      [Mode.Both, EmbedderFixture.Words, Setup.Blocked],
      fellBack,
    ),
  ],
  negative: [
    negative(
      "meaning mode is not built when the vector file cannot open",
      [Mode.Meaning, question, Setup.Blocked],
      { code: ErrorCode.NotBuilt },
    ),
    rejected(
      "meaning mode keeps the kind filter",
      [Mode.Meaning, question, Setup.Ready, KnowledgeKind.Fact],
      empty,
    ),
  ],
};
