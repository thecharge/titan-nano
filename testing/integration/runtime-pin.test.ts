import { unit } from "@titan/test-factories";
import {
  legacyPinSchemaCases,
  runtimeBuildPinCases,
  runtimePinCases,
} from "../cases/runtime-pin.ts";
import { legacyPinSchema, runtimeBuildPin, runtimePin } from "../factories/runtime-pin.ts";

unit(runtimePin, runtimePinCases);

unit(legacyPinSchema, legacyPinSchemaCases);

unit(runtimeBuildPin, runtimeBuildPinCases);
