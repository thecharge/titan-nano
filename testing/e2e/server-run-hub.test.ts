import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { serverHubCases } from "../cases/server-run-hub.ts";
import { serverHubProcess } from "../factories/server-run-hub.ts";

unit(serverHubProcess, serverHubCases, undefined, TestSchedule.Concurrent);
