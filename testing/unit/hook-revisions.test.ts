import { unit } from "@titan/test-factories";
import { parsePushUpdates } from "../../tooling/scripts/hook-revisions.ts";
import { pushInputCases } from "../cases/hooks.ts";

unit(parsePushUpdates, pushInputCases);
