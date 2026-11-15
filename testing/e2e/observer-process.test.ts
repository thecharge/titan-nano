import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { cliConfiguredStartupCases, cliObserverProcessCases } from "../cases/observation.ts";
import { cliConfiguredStartup } from "../factories/configured-startup.ts";
import { cliObserverProcess } from "../factories/observer-process.ts";

unit(
  cliObserverProcess,
  cliObserverProcessCases,
  SdkProcessFixture.CommandTimeout,
  TestSchedule.Concurrent,
);
unit(
  cliConfiguredStartup,
  cliConfiguredStartupCases,
  SdkProcessFixture.CommandTimeout,
  TestSchedule.Concurrent,
);
