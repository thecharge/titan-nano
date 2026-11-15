import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { runCompatibilityCases, storeCompatibilityCases } from "../cases/run-compatibility.ts";
import { runCompatibility, storeCompatibility } from "../factories/run-compatibility.ts";

unit(runCompatibility, runCompatibilityCases, undefined, TestSchedule.Concurrent);

unit(storeCompatibility, storeCompatibilityCases, undefined, TestSchedule.Concurrent);
