import { unit } from "@titan/test-factories";
import { validateEventOptions } from "../../apps/cli/src/commands/runs.ts";
import { cliEventFollowCases, cliEventFollowOptionCases } from "../cases/cli-event-follow.ts";
import { cliEventFollow } from "../factories/cli-event-follow.ts";

unit(cliEventFollow, cliEventFollowCases);
unit(validateEventOptions, cliEventFollowOptionCases);
