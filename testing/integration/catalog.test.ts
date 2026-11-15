import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  catalogInspectionCases,
  catalogQueryCases,
  catalogResponseCases,
  catalogScopeCases,
  catalogSearchCases,
} from "../cases/catalog.ts";
import {
  catalogInspection,
  catalogQuery,
  catalogResponse,
  catalogScope,
  catalogSearch,
} from "../factories/catalog.ts";

unit(catalogInspection, catalogInspectionCases, undefined, TestSchedule.Concurrent);
unit(catalogSearch, catalogSearchCases, undefined, TestSchedule.Concurrent);
unit(catalogResponse, catalogResponseCases, undefined, TestSchedule.Concurrent);
unit(catalogQuery, catalogQueryCases, undefined, TestSchedule.Concurrent);
unit(catalogScope, catalogScopeCases, undefined, TestSchedule.Concurrent);
