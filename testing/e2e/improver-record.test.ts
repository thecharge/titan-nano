import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { improverRecordCases } from "../cases/improver-record.ts";
import { improverRecord } from "../factories/improver-record.ts";

unit(improverRecord, improverRecordCases, undefined, TestSchedule.Concurrent);
