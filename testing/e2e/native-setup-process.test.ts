import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { nativeSetupProcessCases } from "../cases/native-setup-process.ts";
import { nativeSetupProcess } from "../factories/native-setup-process.ts";

unit(
  nativeSetupProcess,
  nativeSetupProcessCases,
  SdkProcessFixture.DaemonTimeout,
  TestSchedule.Concurrent,
);
