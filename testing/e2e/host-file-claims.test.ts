import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { hostFileLeaseGuardCases } from "../cases/host-file-claims.ts";
import { hostFileLeaseProcess } from "../factories/host-file-claims.ts";

unit(
  hostFileLeaseProcess,
  hostFileLeaseGuardCases,
  SdkProcessFixture.CaseTimeout,
  TestSchedule.Concurrent,
);
