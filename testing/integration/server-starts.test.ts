import { unit } from "@titan/test-factories";
import { serverStartsCases } from "../cases/server-starts.ts";
import { serverStarts } from "../factories/server-startup.ts";

unit(serverStarts, serverStartsCases);
