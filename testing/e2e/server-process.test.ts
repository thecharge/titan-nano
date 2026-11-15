import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  scriptedFakeProcessCases,
  scriptedFakeWatchCases,
  serverProcessRecoveryCases,
} from "../cases/server-process.ts";
import { scriptedFakeProcess, scriptedFakeWatch } from "../factories/cli-contract.ts";
import { serverProcessRecovery } from "../factories/server-process.ts";

unit(serverProcessRecovery, serverProcessRecoveryCases, undefined, TestSchedule.Concurrent);

unit(scriptedFakeProcess, scriptedFakeProcessCases);
unit(scriptedFakeWatch, scriptedFakeWatchCases);
