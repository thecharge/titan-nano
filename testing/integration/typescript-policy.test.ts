import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  typeScriptCompilationCases,
  typeScriptSourceScopeCases,
  typeScriptTestingScopeCases,
  typeScriptWorkspaceCapacityCases,
  typeScriptWorkspaceCases,
} from "../cases/typescript-policy.ts";
import {
  typeScriptCompilation,
  typeScriptTestingScope,
  typeScriptWorkspace,
  typeScriptWorkspaceCapacity,
} from "../factories/typescript-policy.ts";

unit(typeScriptWorkspace, typeScriptWorkspaceCases);
unit(typeScriptCompilation, typeScriptCompilationCases, undefined, TestSchedule.Concurrent);

unit(typeScriptWorkspaceCapacity, typeScriptWorkspaceCapacityCases);

unit(typeScriptCompilation, typeScriptSourceScopeCases, undefined, TestSchedule.Concurrent);
unit(typeScriptTestingScope, typeScriptTestingScopeCases);
