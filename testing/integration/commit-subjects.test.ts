import { commitSubjectFailed } from "@titan/messages";
import { unit } from "@titan/test-factories";
import { commitSubjectCases, commitSubjectMessageCases } from "../cases/commit-subjects.ts";
import { commitSubjectCheck } from "../factories/commit-subjects.ts";

unit(commitSubjectCheck, commitSubjectCases);
unit(commitSubjectFailed, commitSubjectMessageCases);
