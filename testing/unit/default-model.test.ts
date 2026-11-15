import { unit } from "@titan/test-factories";
import { modelForCases, modelSettingCases } from "../cases/default-model.ts";
import { modelFor, modelSetting } from "../factories/default-model.ts";

unit(modelFor, modelForCases);
unit(modelSetting, modelSettingCases);
