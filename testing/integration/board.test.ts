import { unit } from "@titan/test-factories";
import {
  boardCases,
  boardRecordCases,
  boardValidationCases,
  durableEventLogCases,
  durableSnapshotCases,
  inspectBoardCases,
  receiptRecordCases,
} from "../cases/board.ts";
import {
  boardRecord,
  boardValidation,
  durableEventLog,
  durableSnapshot,
  inspectBoard,
  receiptRecord,
  replayBoard,
} from "../factories/board.ts";

unit(boardValidation, boardValidationCases);
unit(boardRecord, boardRecordCases);

unit(replayBoard, boardCases);

unit(durableSnapshot, durableSnapshotCases);

unit(durableEventLog, durableEventLogCases);

unit(receiptRecord, receiptRecordCases);

unit(inspectBoard, inspectBoardCases);
