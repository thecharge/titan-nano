import { unit } from "@titan/test-factories";
import { serverTornCases } from "../cases/server-torn.ts";
import { serverTorn } from "../factories/server-startup.ts";

unit(serverTorn, serverTornCases);
