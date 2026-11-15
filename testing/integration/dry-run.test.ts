import { unit } from "@titan/test-factories";
import { dryRunCases } from "../cases/dry-run.ts";
import { dryRunLines } from "../factories/dry-run.ts";

unit(dryRunLines, dryRunCases);
