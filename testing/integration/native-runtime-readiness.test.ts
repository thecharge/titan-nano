import { unit } from "@titan/test-factories";
import { nativeRuntimeReadinessCases } from "../cases/native-runtime-readiness.ts";
import { nativeRuntimeReadiness } from "../factories/native-runtime-readiness.ts";

unit(nativeRuntimeReadiness, nativeRuntimeReadinessCases);
