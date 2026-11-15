import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { attemptInputProcessCases } from "../cases/attempt-input.ts";
import { attemptInputProcess } from "../factories/attempt-input-process.ts";

unit(
  attemptInputProcess,
  attemptInputProcessCases,
  SdkProcessFixture.CaseTimeout,
  TestSchedule.Concurrent,
);
