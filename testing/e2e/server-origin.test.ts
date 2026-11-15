import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { serverOriginCases } from "../cases/server-origin.ts";
import { serverOrigin } from "../factories/server-startup.ts";

unit(serverOrigin, serverOriginCases, undefined, TestSchedule.Concurrent);
