import { unit } from "@titan/test-factories";
import {
  homeModelCases,
  modelCacheCases,
  modelCommandCases,
  modelReadinessCases,
  modelSelectionCases,
} from "../cases/local-model.ts";
import {
  homeModel,
  modelCache,
  modelCommand,
  modelReadiness,
  modelSelection,
} from "../factories/local-model.ts";

unit(modelCache, modelCacheCases);
unit(homeModel, homeModelCases);
unit(modelSelection, modelSelectionCases);

unit(modelCommand, modelCommandCases);

unit(modelReadiness, modelReadinessCases);
