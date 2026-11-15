import { unit } from "@titan/test-factories";
import {
  engineWorkspaceBudgetCases,
  workspaceConfigBudgetCases,
  workspaceReadBudgetCases,
  workspaceWriteBudgetCases,
} from "../cases/workspace-budgets.ts";
import {
  configuredWorkspaceBudget,
  engineWorkspaceBudget,
  workspaceBudget,
} from "../factories/workspace-budgets.ts";

unit(workspaceBudget, workspaceReadBudgetCases);
unit(workspaceBudget, workspaceWriteBudgetCases);
unit(configuredWorkspaceBudget, workspaceConfigBudgetCases);
unit(engineWorkspaceBudget, engineWorkspaceBudgetCases);
