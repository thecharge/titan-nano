import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { candidateCommitmentProcessCases } from "../cases/candidate-commitment.ts";
import { candidateCommitmentProcess } from "../factories/candidate-commitment-process.ts";

unit(
  candidateCommitmentProcess,
  candidateCommitmentProcessCases,
  SdkProcessFixture.CaseTimeout,
  TestSchedule.Concurrent,
);
