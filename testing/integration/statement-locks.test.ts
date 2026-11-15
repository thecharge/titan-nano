import { unit } from "@titan/test-factories";
import { statementAdmissionCases, statementLockCases } from "../cases/statement-locks.ts";
import { statementAdmission, statementLocks } from "../factories/statement-locks.ts";

unit(statementLocks, statementLockCases);

unit(statementAdmission, statementAdmissionCases);
