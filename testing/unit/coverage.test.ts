import { unit } from "@titan/test-factories";
import { coverageGaps, parseCoverage } from "../../tooling/scripts/coverage.ts";
import { coverageGapCases, coverageParseCases } from "../cases/coverage.ts";

unit(parseCoverage, coverageParseCases);
unit(coverageGaps, coverageGapCases);
