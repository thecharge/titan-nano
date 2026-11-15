import { unit } from "@titan/test-factories";
import { coverageRoundTripCases, mergedCoverageCases } from "../cases/coverage-merge.ts";
import { coverageRoundTrip, mergedCoverage } from "../factories/coverage-merge.ts";

unit(mergedCoverage, mergedCoverageCases);
unit(coverageRoundTrip, coverageRoundTripCases);
