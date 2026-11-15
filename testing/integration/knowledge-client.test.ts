import { unit } from "@titan/test-factories";
import {
  knowledgeClientReplyCases,
  knowledgeCliValidationCases,
  knowledgeSearchReplyCases,
} from "../cases/knowledge-client.ts";
import {
  knowledgeClientReply,
  knowledgeCliValidation,
  knowledgeSearchReply,
} from "../factories/knowledge-client.ts";

unit(knowledgeClientReply, knowledgeClientReplyCases);
unit(knowledgeCliValidation, knowledgeCliValidationCases);

unit(knowledgeSearchReply, knowledgeSearchReplyCases);
