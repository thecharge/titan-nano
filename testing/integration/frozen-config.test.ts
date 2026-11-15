import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  frozenConfigInspectionCases,
  frozenConfigProcessCases,
  frozenConfigResponseCases,
} from "../cases/frozen-config.ts";
import {
  frozenConfigInspection,
  frozenConfigProcess,
  frozenConfigResponse,
} from "../factories/frozen-config.ts";

unit(frozenConfigResponse, frozenConfigResponseCases, undefined, TestSchedule.Concurrent);
unit(
  frozenConfigProcess,
  frozenConfigProcessCases,
  SdkProcessFixture.CaseTimeout,
  TestSchedule.Concurrent,
);

unit(frozenConfigInspection, frozenConfigInspectionCases, undefined, TestSchedule.Concurrent);
