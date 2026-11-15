import { unit } from "@titan/test-factories";
import { cliEventFollowProcessCases } from "../cases/cli-event-follow.ts";
import { cliEventFollowProcess } from "../factories/cli-event-follow-process.ts";

unit(cliEventFollowProcess, cliEventFollowProcessCases);
