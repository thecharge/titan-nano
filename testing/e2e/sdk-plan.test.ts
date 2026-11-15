import { SdkDelivery } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { sdkMixedDeliveryCases } from "../cases/sdk-plan.ts";
import { sdkMixedDelivery } from "../factories/sdk-plan.ts";

unit(sdkMixedDelivery, sdkMixedDeliveryCases, SdkDelivery.DaemonTimeout);
