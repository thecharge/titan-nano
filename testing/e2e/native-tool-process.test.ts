import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { nativeToolProcessCases } from "../cases/native-tool-process.ts";
import { nativeToolProcess } from "../factories/native-tool-process.ts";

unit(nativeToolProcess, nativeToolProcessCases, undefined, TestSchedule.Concurrent);
