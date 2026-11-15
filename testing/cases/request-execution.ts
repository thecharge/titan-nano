import { RequestExecutionFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const requestExecutionCases = {
  positive: [
    positive(
      "worker request retains its exact execution after reload",
      [RequestExecutionFixture.Open, false],
      true,
    ),
    positive(
      "checker request retains its exact execution after reload",
      [RequestExecutionFixture.Open, true],
      true,
    ),
    positive(
      "worker decision retains the asking execution",
      [RequestExecutionFixture.Answer, false],
      true,
    ),
    positive(
      "checker decision retains the asking execution",
      [RequestExecutionFixture.Answer, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "oversized worker opening cannot upgrade the live run header",
      [RequestExecutionFixture.WriteAdmission, false],
      true,
    ),
    rejected(
      "oversized checker opening cannot upgrade the live run header",
      [RequestExecutionFixture.WriteAdmission, true],
      true,
    ),
    rejected(
      "a worker finishing during admission cannot append a request",
      [RequestExecutionFixture.AppendRace, false],
      true,
    ),
    rejected(
      "a checker finishing during admission cannot append a request",
      [RequestExecutionFixture.AppendRace, true],
      true,
    ),
    rejected(
      "another step cannot open a phase request",
      [RequestExecutionFixture.Step, false],
      true,
    ),
    rejected(
      "another attempt cannot open a phase request",
      [RequestExecutionFixture.Attempt, false],
      true,
    ),
    rejected(
      "another phase cannot open a worker request",
      [RequestExecutionFixture.Phase, false],
      true,
    ),
    rejected(
      "a completed worker cannot open a checker request",
      [RequestExecutionFixture.Phase, true],
      true,
    ),
    rejected(
      "an obsolete execution cannot open a request",
      [RequestExecutionFixture.Execution, false],
      true,
    ),
    rejected(
      "another native session cannot open a request",
      [RequestExecutionFixture.Session, true],
      true,
    ),
    rejected(
      "another client cannot label a phase request",
      [RequestExecutionFixture.Client, false],
      true,
    ),
    rejected(
      "completed worker cannot create a new request",
      [RequestExecutionFixture.Completed, false],
      true,
    ),
    rejected(
      "completed checker cannot create a new request",
      [RequestExecutionFixture.Completed, true],
      true,
    ),
    rejected(
      "replay refuses a forged worker execution",
      [RequestExecutionFixture.Replay, false],
      true,
    ),
    rejected(
      "replay refuses a forged checker execution",
      [RequestExecutionFixture.Replay, true],
      true,
    ),
  ],
};
