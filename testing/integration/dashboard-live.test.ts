import { unit } from "@titan/test-factories";
import { keepAliveFrameCases, liveFramesCases, provedStepCases } from "../cases/dashboard-unit.ts";
import { keepAliveFrame, liveFrames, provedStep } from "../factories/dashboard-unit.ts";

unit(provedStep, provedStepCases);

unit(liveFrames, liveFramesCases);

unit(keepAliveFrame, keepAliveFrameCases);
