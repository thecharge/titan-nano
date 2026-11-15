import { unit } from "@titan/test-factories";
import { embedderRecordCases } from "../cases/embedder-record.ts";
import { embedderRecord } from "../factories/embedder-record.ts";

unit(embedderRecord, embedderRecordCases);
