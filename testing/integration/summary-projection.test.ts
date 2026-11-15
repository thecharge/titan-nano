import { unit } from "@titan/test-factories";
import {
  summaryCacheCases,
  summaryMigrationCases,
  summaryProjectionCases,
} from "../cases/summary-projection.ts";
import {
  summaryCache,
  summaryMigration,
  summaryProjection,
} from "../factories/summary-projection.ts";

unit(summaryProjection, summaryProjectionCases);

unit(summaryCache, summaryCacheCases);

unit(summaryMigration, summaryMigrationCases);
