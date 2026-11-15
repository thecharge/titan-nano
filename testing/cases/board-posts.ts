import { BoardLoad, BoardTalk, RequestKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const boardAfterQuestionCases = {
  positive: [
    positive(
      "persona-board > Board after a run with a question: fixer asks investigator and gets the answer",
      [BoardTalk.Fixer, BoardTalk.Investigator, true, true],
      "fixer>investigator:ask,investigator>fixer:answer",
    ),
    positive(
      "persona-board > Board after a run with a question: skeptic asks planner and gets the answer",
      [BoardTalk.Skeptic, BoardTalk.Planner, true, true],
      "skeptic>planner:ask,planner>skeptic:answer",
    ),
  ],
  negative: [
    rejected(
      "persona-board > Board after a run with a question: an unanswered question has no answer line",
      [BoardTalk.Fixer, BoardTalk.Investigator, true, false],
      "fixer>investigator:ask",
    ),
    rejected(
      "persona-board > Board after a run with a question: no question leaves no line",
      [BoardTalk.Fixer, BoardTalk.Investigator, false, false],
      "",
    ),
  ],
};

export const parallelBoardWritesCases = {
  positive: [
    positive(
      "persona-board > Parallel steps write at the same time: 8 steps write 2000 messages each",
      [BoardLoad.Writers, BoardLoad.PostsPerWriter, false],
      "16000 true",
    ),
    positive(
      "persona-board > Parallel steps write at the same time: 2 steps write 50 messages each",
      [2, 50, false],
      "100 true",
    ),
  ],
  negative: [
    rejected(
      "persona-board > Parallel steps write at the same time: no writers add no lines",
      [0, 10, false],
      "0 true",
    ),
    rejected(
      "persona-board > Parallel steps write at the same time: a torn line is not valid JSON",
      [1, 5, true],
      "6 false",
    ),
  ],
};

export const unknownRequestKindCases = {
  positive: [
    positive(
      "persona-board > Unknown request kind: delete_files is refused and not acted on",
      [BoardTalk.UnknownKind],
      '1 unknown request kind "delete_files" 0',
    ),
    positive(
      "persona-board > Unknown request kind: format_disk is refused and not acted on",
      [BoardTalk.OtherUnknownKind],
      '1 unknown request kind "format_disk" 0',
    ),
  ],
  negative: [
    rejected(
      "persona-board > Unknown request kind: a known replan kind is not refused",
      [RequestKind.Replan],
      "0  1",
    ),
    rejected(
      "persona-board > Unknown request kind: a known ask kind is not refused",
      [RequestKind.Ask],
      "0  1",
    ),
  ],
};
