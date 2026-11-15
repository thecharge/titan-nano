import { ErrorCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { StreamMessage, WorkspaceMessage } from "@titan/messages";
import type { ByteWriter } from "@titan/types";

export async function writeAll(buffer: Uint8Array, write: ByteWriter): Promise<void> {
  let offset = 0;
  while (offset < buffer.length) {
    const remaining = buffer.length - offset;
    const written = await write(buffer, offset, remaining);
    if (!Number.isSafeInteger(written) || written < 1 || written > remaining)
      throw new TitanError(ErrorCode.DurableWrite, WorkspaceMessage.WriteStalled);
    offset += written;
  }
}

export function validateByteLimit(maximum: number): void {
  if (!Number.isSafeInteger(maximum) || maximum < 1)
    throw new TitanError(ErrorCode.InvalidStreamLimit, StreamMessage.InvalidLimit);
}
