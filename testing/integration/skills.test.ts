import { unit } from "@titan/test-factories";
import { claudeRegistrationCases, projectSkillCases } from "../cases/skills.ts";
import { claudeRegistration, projectSkill } from "../factories/skills.ts";

unit(projectSkill, projectSkillCases);

unit(claudeRegistration, claudeRegistrationCases);
