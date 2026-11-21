import { SdkDelivery } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { sdkMixedDeliveryCases, sdkMixedRestartCases } from "../cases/sdk-plan.ts";
import { sdkMixedDelivery, sdkMixedRestart } from "../factories/sdk-plan.ts";

unit(sdkMixedDelivery, sdkMixedDeliveryCases, SdkDelivery.DaemonTimeout);
unit(sdkMixedRestart, sdkMixedRestartCases, SdkDelivery.DaemonTimeout);
