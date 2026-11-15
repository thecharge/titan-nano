import { unit } from "@titan/test-factories";
import {
  runQueueCapacityCases,
  runQueueSettingCases,
  submissionQueueCapacityCases,
} from "../cases/run-queue.ts";
import {
  runQueueCapacity,
  runQueueSettings,
  submissionQueueCapacity,
} from "../factories/run-queue.ts";

unit(runQueueSettings, runQueueSettingCases);
unit(runQueueCapacity, runQueueCapacityCases);
unit(submissionQueueCapacity, submissionQueueCapacityCases);
