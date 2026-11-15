import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { helperProcessCases } from "../cases/helper-process.ts";
import { helperProcess } from "../factories/helper-process.ts";

unit(helperProcess, helperProcessCases, SdkProcessFixture.CaseTimeout, TestSchedule.Concurrent);
