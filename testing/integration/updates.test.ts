import { unit } from "@titan/test-factories";
import {
  updateCommandNoticeCases,
  updateConcurrentNoticeCases,
  updateGitCheckCases,
  updateNoticeLeaseCases,
  updateNoticeLifecycleCases,
  updateOwnerSettingsCases,
  updateQueryDeadlineCases,
  updateReadOnlyCheckCases,
  updateUnavailableSourceCases,
} from "../cases/updates.ts";
import {
  updateCommandNotice,
  updateConcurrentNotice,
  updateGitCheck,
  updateNoticeLease,
  updateNoticeLifecycle,
  updateOwnerSettings,
  updateQueryDeadline,
  updateReadOnlyCheck,
  updateUnavailableSource,
} from "../factories/updates.ts";

unit(updateOwnerSettings, updateOwnerSettingsCases);
unit(updateNoticeLifecycle, updateNoticeLifecycleCases);
unit(updateConcurrentNotice, updateConcurrentNoticeCases);
unit(updateReadOnlyCheck, updateReadOnlyCheckCases);
unit(updateCommandNotice, updateCommandNoticeCases);
unit(updateGitCheck, updateGitCheckCases);
unit(updateUnavailableSource, updateUnavailableSourceCases);
unit(updateQueryDeadline, updateQueryDeadlineCases);
unit(updateNoticeLease, updateNoticeLeaseCases);
