import { unit } from "@titan/test-factories";
import {
  requestRecordBudgetCases,
  requestTurnRecordAdmissionCases,
} from "../cases/request-record-budget.ts";
import {
  requestRecordBudget,
  requestTurnRecordAdmission,
} from "../factories/request-record-budget.ts";

unit(requestRecordBudget, requestRecordBudgetCases);

unit(requestTurnRecordAdmission, requestTurnRecordAdmissionCases);
