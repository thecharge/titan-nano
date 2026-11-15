import { Backend, RequestTurnFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeRequestTurnCases = {
  positive: [
    positive(
      "Codex caller metadata survives worker wait and native resume",
      [false, true, false, false, Backend.Codex, 1, 256, RequestTurnFixture.None, "outer-codex"],
      true,
    ),
    positive(
      "Claude caller metadata survives checker wait and native resume",
      [true, true, false, false, Backend.Claude, 1, 256, RequestTurnFixture.None, "outer-claude"],
      true,
    ),
    positive(
      "Codex worker request resumes its native stub session",
      [false, true, false, false, Backend.Codex],
      true,
    ),
    positive(
      "Codex checker request resumes its native stub session",
      [true, true, false, false, Backend.Codex],
      true,
    ),
    positive(
      "Claude worker request resumes its native stub session",
      [false, true, false, false, Backend.Claude],
      true,
    ),
    positive(
      "Claude checker request resumes its native stub session",
      [true, true, false, false, Backend.Claude],
      true,
    ),
  ],
  negative: [
    rejected(
      "Codex unanswered request cannot start another native turn",
      [false, true, true, false, Backend.Codex],
      true,
    ),
    rejected(
      "Codex malformed wait cannot publish requests",
      [true, false, false, true, Backend.Codex],
      true,
    ),
    rejected(
      "Claude unanswered request cannot start another native turn",
      [false, true, true, false, Backend.Claude],
      true,
    ),
    rejected(
      "Claude malformed wait cannot publish requests",
      [true, false, false, true, Backend.Claude],
      true,
    ),
  ],
};
