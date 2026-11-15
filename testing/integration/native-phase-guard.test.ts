import { unit } from "@titan/test-factories";
import { nativePhaseGuardCases } from "../cases/native-phase-guard.ts";
import { nativePhaseGuard } from "../factories/native-phase-guard.ts";

unit(nativePhaseGuard, nativePhaseGuardCases);
