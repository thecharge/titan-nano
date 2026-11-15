import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { cliEnvelopeProcessCases } from "../cases/cli-output.ts";
import { cliEnvelopeProcess } from "../factories/cli-output.ts";

unit(cliEnvelopeProcess, cliEnvelopeProcessCases, undefined, TestSchedule.Concurrent);
