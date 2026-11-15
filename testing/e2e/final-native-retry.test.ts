import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { finalAttemptRetryCases } from "../cases/final-native-retry.ts";
import { finalAttemptRetry } from "../factories/final-native-retry.ts";

unit(
  finalAttemptRetry,
  finalAttemptRetryCases,
  SdkProcessFixture.CaseTimeout,
  TestSchedule.Concurrent,
);
