import { unit } from "@titan/test-factories";
import { serverTokenCases } from "../cases/server-token.ts";
import { serverToken } from "../factories/server-startup.ts";

unit(serverToken, serverTokenCases);
