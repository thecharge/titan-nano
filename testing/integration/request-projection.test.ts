import { unit } from "@titan/test-factories";
import { requestProjectionCases } from "../cases/request-projection.ts";
import { requestProjection } from "../factories/request-projection.ts";

unit(requestProjection, requestProjectionCases);
