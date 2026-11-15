import { unit } from "@titan/test-factories";
import { serverRunCases } from "../cases/server-run.ts";
import { serverRun } from "../factories/server-run.ts";

unit(serverRun, serverRunCases);
