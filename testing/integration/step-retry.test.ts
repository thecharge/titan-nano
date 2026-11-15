import { unit } from "@titan/test-factories";
import { neverSurvivesCases, survivesOnSecondAttemptCases } from "../cases/step-retry.ts";
import { neverSurvives, survivesOnSecondAttempt } from "../factories/step-retry.ts";

unit(survivesOnSecondAttempt, survivesOnSecondAttemptCases);
unit(neverSurvives, neverSurvivesCases);
