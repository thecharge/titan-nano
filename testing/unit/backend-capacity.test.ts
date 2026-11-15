import { unit } from "@titan/test-factories";
import { backendCapacitySettingsCases } from "../cases/backend-capacity.ts";
import { backendCapacitySettings } from "../factories/backend-capacity-settings.ts";

unit(backendCapacitySettings, backendCapacitySettingsCases);
