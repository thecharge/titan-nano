import { unit } from "@titan/test-factories";
import { schedulingProbeCases } from "../cases/scheduling.ts";
import { schedulingProbe } from "../factories/scheduling.ts";

unit(schedulingProbe, schedulingProbeCases);
