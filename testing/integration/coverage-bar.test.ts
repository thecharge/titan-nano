import { unit } from "@titan/test-factories";
import { coverageBarCases } from "../cases/coverage-bar.ts";
import { coverageRun } from "../factories/coverage-bar.ts";

unit(coverageRun, coverageBarCases);
