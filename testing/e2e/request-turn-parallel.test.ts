import { SdkDelivery } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { requestTurnParallelCases } from "../cases/request-turn-parallel.ts";
import { requestTurnParallel } from "../factories/request-turn-parallel.ts";

unit(requestTurnParallel, requestTurnParallelCases, SdkDelivery.DaemonTimeout);
