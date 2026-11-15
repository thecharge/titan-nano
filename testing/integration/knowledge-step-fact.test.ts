import { unit } from "@titan/test-factories";
import {
  knowledgeStepFactKeptCases,
  knowledgeStepFactUndoneCases,
} from "../cases/knowledge-step-fact.ts";
import { knowledgeStepFact } from "../factories/knowledge-step-fact.ts";

unit(knowledgeStepFact, knowledgeStepFactKeptCases);
unit(knowledgeStepFact, knowledgeStepFactUndoneCases);
