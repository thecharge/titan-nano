import { unit } from "@titan/test-factories";
import { serverKillCases } from "../cases/server-run.ts";
import { serverKill } from "../factories/server-run.ts";

unit(serverKill, serverKillCases);
