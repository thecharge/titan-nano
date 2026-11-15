import { SdkProcessFixture } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { requestTurnProcessCases } from "../cases/request-turn-process.ts";
import { requestTurnProcess } from "../factories/request-turn-process.ts";

unit(requestTurnProcess, requestTurnProcessCases, SdkProcessFixture.CaseTimeout);
