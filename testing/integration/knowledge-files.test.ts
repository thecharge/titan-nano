import { unit } from "@titan/test-factories";
import {
  knowledgeFileRecoveryCases,
  knowledgeSearchBudgetCases,
} from "../cases/knowledge-files.ts";
import { knowledgeFileRecovery, knowledgeSearchBudget } from "../factories/knowledge-files.ts";

unit(knowledgeFileRecovery, knowledgeFileRecoveryCases);
unit(knowledgeSearchBudget, knowledgeSearchBudgetCases);
