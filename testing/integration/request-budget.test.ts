import { unit } from "@titan/test-factories";
import { requestBudgetCases, requestBudgetLayerCases } from "../cases/request-budget.ts";
import { requestBudget, requestBudgetLayers } from "../factories/request-budget.ts";

unit(requestBudgetLayers, requestBudgetLayerCases);
unit(requestBudget, requestBudgetCases);
