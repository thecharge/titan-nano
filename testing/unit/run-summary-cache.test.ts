import { unit } from "@titan/test-factories";
import { runSummaryCases } from "../cases/run-summary-cache.ts";
import { runSummaryReads } from "../factories/run-summary-cache.ts";

unit(runSummaryReads, runSummaryCases);
