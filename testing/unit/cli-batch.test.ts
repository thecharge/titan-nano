import { unit } from "@titan/test-factories";
import { cliBatchCheckCases } from "../cases/examples.ts";
import { cliBatchCheck } from "../factories/cli-batch.ts";

unit(cliBatchCheck, cliBatchCheckCases);
