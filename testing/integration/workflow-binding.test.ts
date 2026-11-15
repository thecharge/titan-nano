import { unit } from "@titan/test-factories";
import { cliWorkflowBindingCases, mcpConfiguredCheckCases } from "../cases/workflow-binding.ts";
import { cliWorkflowBinding, mcpConfiguredCheck } from "../factories/workflow-binding.ts";

unit(cliWorkflowBinding, cliWorkflowBindingCases);
unit(mcpConfiguredCheck, mcpConfiguredCheckCases);
