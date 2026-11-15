import { unit } from "@titan/test-factories";
import {
  knowledgeHistoryReplyCases,
  knowledgeHistorySurfaceCases,
  knowledgeKindDatesCases,
  retainedHistoryFramingCases,
  retainedKnowledgeHistoryCases,
} from "../cases/knowledge-history.ts";
import {
  knowledgeHistoryReply,
  knowledgeHistorySurface,
  knowledgeKindDates,
  retainedHistoryFraming,
  retainedKnowledgeHistory,
} from "../factories/knowledge-history.ts";

unit(retainedKnowledgeHistory, retainedKnowledgeHistoryCases);
unit(knowledgeHistoryReply, knowledgeHistoryReplyCases);
unit(knowledgeKindDates, knowledgeKindDatesCases);

unit(knowledgeHistorySurface, knowledgeHistorySurfaceCases);

unit(retainedHistoryFraming, retainedHistoryFramingCases);
