import { unit } from "@titan/test-factories";
import {
  scopedCloneCases,
  scopedLookupCases,
  scopedOpenCases,
  scopedSearchCases,
} from "../cases/knowledge-scope.ts";
import {
  scopedClone,
  scopedLookup,
  scopedOpen,
  scopedSearch,
} from "../factories/knowledge-scope.ts";

unit(scopedSearch, scopedSearchCases);
unit(scopedLookup, scopedLookupCases);
unit(scopedClone, scopedCloneCases);
unit(scopedOpen, scopedOpenCases);
