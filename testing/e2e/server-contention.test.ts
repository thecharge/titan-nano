import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { serverReaderContentionCases } from "../cases/server-contention.ts";
import { serverReaderContention } from "../factories/server-contention.ts";

unit(serverReaderContention, serverReaderContentionCases, undefined, TestSchedule.Concurrent);
