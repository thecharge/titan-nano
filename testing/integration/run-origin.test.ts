import { unit } from "@titan/test-factories";
import { runOriginCases } from "../cases/run-origin.ts";
import { runOrigin } from "../factories/run-origin.ts";

unit(runOrigin, runOriginCases);
