import { unit } from "@titan/test-factories";
import {
  claudePathPolicyCases,
  claudeScopedWriteCases,
  claudeStoppedPolicyCases,
  claudeToolPolicyCases,
} from "../cases/claude-policy.ts";
import {
  claudePathPolicy,
  claudeScopedWrite,
  claudeStoppedPolicy,
  claudeToolPolicy,
} from "../factories/claude-policy.ts";

unit(claudeToolPolicy, claudeToolPolicyCases);
unit(claudeScopedWrite, claudeScopedWriteCases);

unit(claudePathPolicy, claudePathPolicyCases);

unit(claudeStoppedPolicy, claudeStoppedPolicyCases);
