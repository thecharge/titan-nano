import { unit } from "@titan/test-factories";
import { nativeEventProjectionCases } from "../cases/native-events.ts";
import { nativeEventProjection } from "../factories/native-events.ts";

unit(nativeEventProjection, nativeEventProjectionCases);
