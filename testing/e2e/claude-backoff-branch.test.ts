import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { claudeBackoffBranchCases } from "../cases/claude-backoff-branch.ts";
import { claudeBackoffBranch } from "../factories/claude-backoff.ts";

unit(
  claudeBackoffBranch,
  claudeBackoffBranchCases,
  SdkProcessFixture.CaseTimeout,
  TestSchedule.Concurrent,
);
