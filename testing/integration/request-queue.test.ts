import { unit } from "@titan/test-factories";
import { requestQueueCapacityCases, requestQueueSettingCases } from "../cases/request-queue.ts";
import { requestQueueCapacity, requestQueueSettings } from "../factories/request-queue.ts";

unit(requestQueueSettings, requestQueueSettingCases);
unit(requestQueueCapacity, requestQueueCapacityCases);
