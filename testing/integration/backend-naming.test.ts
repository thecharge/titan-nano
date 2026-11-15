import { unit } from "@titan/test-factories";
import { backendNamingCases } from "../cases/program-api.ts";
import { backendNaming } from "../factories/program-api.ts";

unit(backendNaming, backendNamingCases);
