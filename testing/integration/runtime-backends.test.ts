import { unit } from "@titan/test-factories";
import { runtimeBackendCases } from "../cases/sdk-process.ts";
import { runtimeBackend } from "../factories/sdk-process.ts";

unit(runtimeBackend, runtimeBackendCases);
