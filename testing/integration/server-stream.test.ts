import { unit } from "@titan/test-factories";
import { serverStreamCases } from "../cases/server-run.ts";
import { serverStream } from "../factories/server-run.ts";

unit(serverStream, serverStreamCases);
