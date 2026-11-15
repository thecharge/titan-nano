import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { claudeProcessRetryCases } from "../cases/claude-retry-process.ts";
import { claudeProcessRetry } from "../factories/claude-retry-process.ts";

unit(
  claudeProcessRetry,
  claudeProcessRetryCases,
  SdkProcessFixture.CaseTimeout,
  TestSchedule.Concurrent,
);
