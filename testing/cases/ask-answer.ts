import { AskMode, RequestDecision } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const askAnswerCases = {
  positive: [
    positive(
      "answer to one question reaches the next prompt of the asking session",
      [1, false, AskMode.Answered],
      "true false false true 2",
    ),
    positive(
      "two answers reach the asking session while another board message stays out",
      [2, true, AskMode.Answered],
      "true false false true 2",
    ),
  ],
  negative: [
    rejected(
      "unanswered question spends no turn when the run is resumed",
      [1, true, AskMode.Unanswered],
      "false false false true 1",
    ),
    rejected(
      "second conflicting answer is refused and never reaches the asking session",
      [1, false, AskMode.Conflicting],
      "true false false true 2",
    ),
  ],
};

export const boardIsolationCases = {
  positive: [
    positive(
      "skeptic prompt holds neither message of an ask and answer exchange",
      [1, false, 0, RequestDecision.Approve],
      "1 false false false",
    ),
    positive(
      "skeptic prompt holds neither message of two messages posted directly on the board",
      [0, true, 0, RequestDecision.Approve],
      "1 false false false",
    ),
  ],
  negative: [
    rejected(
      "skeptic gets only the answer to its own question, not the fixer exchange",
      [1, true, 1, RequestDecision.Approve],
      "2 false false true",
    ),
    rejected(
      "denied fixer questions stay out of the skeptic prompt",
      [2, true, 0, RequestDecision.Deny],
      "1 false false false",
    ),
  ],
};
