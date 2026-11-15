import { unit } from "@titan/test-factories";
import {
  boundedWorkCases,
  competingFailureCases,
  settledWorkCases,
  stoppedWorkCases,
} from "../cases/concurrency.ts";
import {
  boundedWork,
  competingFailures,
  settledWork,
  stoppedWork,
} from "../factories/concurrency.ts";

unit(boundedWork, boundedWorkCases);
unit(stoppedWork, stoppedWorkCases);

unit(settledWork, settledWorkCases);

unit(competingFailures, competingFailureCases);
