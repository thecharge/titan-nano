import { unit } from "@titan/test-factories";
import {
  cliSettingAssignmentCases,
  cliSettingSubmissionCases,
  settingAssignmentCases,
} from "../cases/setting-overrides.ts";
import {
  cliSettingAssignments,
  cliSettingSubmission,
  settingAssignments,
} from "../factories/setting-overrides.ts";

unit(settingAssignments, settingAssignmentCases);
unit(cliSettingAssignments, cliSettingAssignmentCases);
unit(cliSettingSubmission, cliSettingSubmissionCases);
