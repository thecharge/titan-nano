import { unit } from "@titan/test-factories";
import { serverRestartCases } from "../cases/server-restart.ts";
import { serverRestart } from "../factories/server-startup.ts";

unit(serverRestart, serverRestartCases);
