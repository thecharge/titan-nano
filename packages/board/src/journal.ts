import { type FileHandle, open } from "node:fs/promises";
import {
  BoardLimit,
  ErrorCode,
  ErrorField,
  FileEncoding,
  FileErrorCode,
  FileOpenMode,
  Newline,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { BoardMessage } from "@titan/messages";
import { fileHandleChunks } from "@titan/streams";
import type { BoardLine } from "@titan/types";

export async function* boardLines(path: string): AsyncGenerator<BoardLine> {
  let file: FileHandle;
  try {
    file = await open(path, FileOpenMode.Read);
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return;
    throw error;
  }
  try {
    yield* readBoardLines(file);
  } finally {
    await file.close();
  }
}

function checkRecordBytes(bytes: number): void {
  if (bytes > BoardLimit.RecordBytes)
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Limit);
}

async function* readBoardLines(file: FileHandle): AsyncGenerator<BoardLine> {
  let pending = Buffer.alloc(0);
  let end = 0;
  for await (const chunk of fileHandleChunks(file)) {
    pending = Buffer.concat([pending, chunk]);
    let newline = pending.indexOf(Newline);
    while (newline >= 0) {
      checkRecordBytes(newline);
      end += newline + 1;
      yield { text: pending.subarray(0, newline).toString(FileEncoding.Utf8), end };
      pending = pending.subarray(newline + 1);
      newline = pending.indexOf(Newline);
    }
    checkRecordBytes(pending.length);
  }
}
