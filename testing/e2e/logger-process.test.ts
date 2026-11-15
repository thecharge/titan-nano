import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { loggerProcessCases } from "../cases/logger-process.ts";
import { loggerProcess } from "../factories/logger-process.ts";

unit(loggerProcess, loggerProcessCases, undefined, TestSchedule.Concurrent);
