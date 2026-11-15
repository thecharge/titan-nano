import { unit } from "@titan/test-factories";
import { knowledgeCliScopeCases } from "../cases/knowledge-cli-scope.ts";
import { knowledgeCliScope } from "../factories/knowledge-cli-scope.ts";

unit(knowledgeCliScope, knowledgeCliScopeCases);
