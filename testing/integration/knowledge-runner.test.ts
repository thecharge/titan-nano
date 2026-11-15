import { unit } from "@titan/test-factories";
import {
  knowledgeRunnerConflictCases,
  knowledgeRunnerDecisionCases,
} from "../cases/knowledge-runner.ts";
import { knowledgeRunnerConflict, knowledgeRunnerDecision } from "../factories/knowledge-runner.ts";

unit(knowledgeRunnerDecision, knowledgeRunnerDecisionCases);
unit(knowledgeRunnerConflict, knowledgeRunnerConflictCases);
