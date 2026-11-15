import { unit } from "@titan/test-factories";
import { concurrentWorkflowIsolationCases } from "../cases/concurrent-workflows.ts";
import { concurrentWorkflowIsolation } from "../factories/concurrent-workflows.ts";

unit(concurrentWorkflowIsolation, concurrentWorkflowIsolationCases);
