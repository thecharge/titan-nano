import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { serverRestartFolderCases } from "../cases/server-restart-folder.ts";
import { serverRestartFolder } from "../factories/server-restart-folder.ts";

unit(serverRestartFolder, serverRestartFolderCases, undefined, TestSchedule.Concurrent);
