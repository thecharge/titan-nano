import { unit } from "@titan/test-factories";
import { globalWorkspaceGuardCases, scopedWorkspaceCases } from "../cases/workspace-secrets.ts";
import { globalWorkspaceGuard, scopedWorkspace } from "../factories/workspace-secrets.ts";

unit(scopedWorkspace, scopedWorkspaceCases);
unit(globalWorkspaceGuard, globalWorkspaceGuardCases);
