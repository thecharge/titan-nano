import { unit } from "@titan/test-factories";
import { serverHubCases } from "../cases/server-run-hub.ts";
import { serverHub } from "../factories/server-run-hub.ts";

unit(serverHub, serverHubCases);
