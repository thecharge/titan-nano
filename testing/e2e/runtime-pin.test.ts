import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { runtimePinProcessCases } from "../cases/runtime-pin.ts";
import { runtimePinProcess } from "../factories/runtime-pin.ts";

unit(runtimePinProcess, runtimePinProcessCases, undefined, TestSchedule.Concurrent);
