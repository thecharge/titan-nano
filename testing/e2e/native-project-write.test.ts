import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { nativeProjectWriteCases } from "../cases/native-project-write.ts";
import { nativeProjectWrite } from "../factories/native-project-write.ts";

unit(nativeProjectWrite, nativeProjectWriteCases, undefined, TestSchedule.Concurrent);
