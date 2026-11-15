import { unit } from "@titan/test-factories";
import {
  guideRulesCases,
  guideSchemaCases,
  guideSequentialCases,
  guideStepsCases,
  installAntigravityCases,
  installClaudeConnectionCases,
  installCodexCases,
  installExecutableCases,
  installForceCases,
  installForeignCases,
  installProjectCases,
  installReleaseLauncherCases,
  launchCases,
  skillHeaderCases,
} from "../cases/main-agent-guide.ts";
import {
  guideRules,
  guideSchema,
  guideSequential,
  guideSteps,
  installAntigravity,
  installClaudeConnection,
  installCodex,
  installExecutable,
  installForce,
  installForeign,
  installProject,
  installReleaseLauncher,
  launchExit,
  skillHeader,
} from "../factories/main-agent-guide.ts";

unit(guideSteps, guideStepsCases);
unit(guideRules, guideRulesCases);
unit(guideSchema, guideSchemaCases);
unit(guideSequential, guideSequentialCases);
unit(installProject, installProjectCases);
unit(installCodex, installCodexCases);
unit(installForeign, installForeignCases);
unit(installAntigravity, installAntigravityCases);
unit(installForce, installForceCases);
unit(skillHeader, skillHeaderCases);
unit(launchExit, launchCases);

unit(installExecutable, installExecutableCases);

unit(installClaudeConnection, installClaudeConnectionCases);
unit(installReleaseLauncher, installReleaseLauncherCases);
