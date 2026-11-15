import { unit } from "@titan/test-factories";
import {
  knowledgeViewCycleCases,
  knowledgeViewDeleteCases,
  knowledgeViewEditCases,
  knowledgeViewGuardCases,
  knowledgeViewRaceCases,
  knowledgeViewScopeCases,
} from "../cases/knowledge-view.ts";
import {
  knowledgeViewCycle,
  knowledgeViewDelete,
  knowledgeViewEdit,
  knowledgeViewGuard,
  knowledgeViewRace,
  knowledgeViewScope,
} from "../factories/knowledge-view.ts";

unit(knowledgeViewCycle, knowledgeViewCycleCases);
unit(knowledgeViewEdit, knowledgeViewEditCases);
unit(knowledgeViewDelete, knowledgeViewDeleteCases);
unit(knowledgeViewGuard, knowledgeViewGuardCases);

unit(knowledgeViewRace, knowledgeViewRaceCases);

unit(knowledgeViewScope, knowledgeViewScopeCases);
