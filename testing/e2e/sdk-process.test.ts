import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { sdkProcessRecoveryCases } from "../cases/sdk-process.ts";
import { sdkProcessRecovery } from "../factories/sdk-process.ts";

unit(
  sdkProcessRecovery,
  sdkProcessRecoveryCases,
  SdkProcessFixture.CaseTimeout,
  TestSchedule.Concurrent,
);
