import { unit } from "@titan/test-factories";
import { sandboxDistributionCases } from "../cases/sandbox-distribution.ts";
import { sandboxDistribution } from "../factories/sandbox-distribution.ts";

unit(sandboxDistribution, sandboxDistributionCases);
