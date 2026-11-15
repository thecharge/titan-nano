import { unit } from "@titan/test-factories";
import { coverageSourceScopeCases } from "../cases/coverage.ts";
import { coverageSourceScope } from "../factories/coverage-scope.ts";

unit(coverageSourceScope, coverageSourceScopeCases);
