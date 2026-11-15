import { test } from "bun:test";
import { unit } from "@titan/test-factories";
import {
  cliBranchFailureCases,
  cliResultPathCases,
  workflowCheckCases,
  workflowInputCases,
} from "../cases/workflow.ts";
import { cliWorkflowCheck, cliWorkflowInputs } from "../factories/cli.ts";
import {
  cliBranchFailure,
  cliEntrypointDiagnostics,
  cliResultPath,
  cliRuntimeComposition,
  cliServeLifecycle,
  cliWorkflowDelivery,
} from "../factories/cli-contract.ts";

test("CLI validates, submits, observes and inspects a stubbed workflow", cliWorkflowDelivery);
test("CLI serve reports readiness and shuts down as an independent process", cliServeLifecycle);
test(
  "entrypoint converts input failures to one JSON envelope or one diagnostic",
  cliEntrypointDiagnostics,
);
test(
  "runtime composition starts the actual server and stops through a lifecycle port",
  cliRuntimeComposition,
);

unit(cliBranchFailure, cliBranchFailureCases);

unit(cliResultPath, cliResultPathCases);
unit(cliWorkflowInputs, workflowInputCases);
unit(cliWorkflowCheck, workflowCheckCases);
