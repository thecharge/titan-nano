import { unit } from "@titan/test-factories";
import { boundaryBudgetCases } from "../cases/boundary-budget.ts";
import { boundaryBudget } from "../factories/boundary-budget.ts";

unit(boundaryBudget, boundaryBudgetCases);
