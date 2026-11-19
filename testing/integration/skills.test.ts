import { unit } from "@titan/test-factories";
import {
  claudeRegistrationCases,
  projectSkillCases,
  workflowSkillPreflightCases,
} from "../cases/skills.ts";
import { claudeRegistration, projectSkill, workflowSkillPreflight } from "../factories/skills.ts";

unit(projectSkill, projectSkillCases);

unit(claudeRegistration, claudeRegistrationCases);

unit(workflowSkillPreflight, workflowSkillPreflightCases);
