import { unit } from "@titan/test-factories";
import {
  loggerFramingCases,
  loggerHostileCases,
  loggerQueueCases,
  loggerRecordCases,
  loggerSinkCases,
} from "../cases/logging.ts";
import {
  loggerFraming,
  loggerHostile,
  loggerQueue,
  loggerRecord,
  loggerSink,
} from "../factories/logging.ts";

unit(loggerRecord, loggerRecordCases);
unit(loggerSink, loggerSinkCases);
unit(loggerQueue, loggerQueueCases);

unit(loggerHostile, loggerHostileCases);

unit(loggerFraming, loggerFramingCases);
