import { unit } from "@titan/test-factories";
import {
  knowledgeViewSearchBudgetCases,
  knowledgeViewSearchGuardCases,
  knowledgeViewSearchOwnCases,
  knowledgeViewSearchPageCases,
  knowledgeViewSearchQueueCases,
  knowledgeViewSearchTerminalCases,
} from "../cases/knowledge-view-search.ts";
import {
  knowledgeViewSearchBudget,
  knowledgeViewSearchGuard,
  knowledgeViewSearchOwn,
  knowledgeViewSearchPage,
  knowledgeViewSearchQueue,
  knowledgeViewSearchTerminal,
} from "../factories/knowledge-view-search.ts";

unit(knowledgeViewSearchOwn, knowledgeViewSearchOwnCases);
unit(knowledgeViewSearchPage, knowledgeViewSearchPageCases);
unit(knowledgeViewSearchTerminal, knowledgeViewSearchTerminalCases);
unit(knowledgeViewSearchGuard, knowledgeViewSearchGuardCases);
unit(knowledgeViewSearchQueue, knowledgeViewSearchQueueCases);
unit(knowledgeViewSearchBudget, knowledgeViewSearchBudgetCases);
