import { FileErrorCode, RequestProjectionFixture } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const requestProjectionCases = {
  positive: [
    positive(
      "approval removes only its request and escalation survives reload",
      [RequestProjectionFixture.Approve],
      true,
    ),
    positive(
      "denial removes only its request and stale bytes are rebuilt",
      [RequestProjectionFixture.Deny],
      true,
    ),
    positive(
      "missing projection is rebuilt from journal requests",
      [RequestProjectionFixture.Missing],
      true,
    ),
    positive(
      "malformed projection cannot replace authoritative history",
      [RequestProjectionFixture.Stale],
      true,
    ),
  ],
  negative: [
    negative(
      "opening publication failure fences acknowledgement until reload",
      [RequestProjectionFixture.OpenFailure],
      { code: FileErrorCode.IsDirectory },
    ),
    negative(
      "answer publication failure retains its durable decision on reload",
      [RequestProjectionFixture.AnswerFailure],
      { code: FileErrorCode.IsDirectory },
    ),
    negative("failed rebuild cannot admit a loaded run", [RequestProjectionFixture.RepairFailure], {
      code: FileErrorCode.IsDirectory,
    }),
  ],
};
