import { ErrorCode, IoLimit } from "@titan/constants";
import { validateByteLimit } from "@titan/core";
import { TitanError } from "@titan/errors";
import { StreamMessage } from "@titan/messages";

export { validateByteLimit } from "@titan/core";

export class ByteCollector {
  private pages: Buffer[] = [];
  private page = Buffer.alloc(0);
  private used = 0;
  private size = 0;

  constructor(private maximum: number) {
    validateByteLimit(maximum);
  }

  append(chunk: Uint8Array): void {
    if (this.size + chunk.byteLength > this.maximum)
      throw new TitanError(ErrorCode.StreamLimit, StreamMessage.Exceeded);
    let offset = 0;
    while (offset < chunk.byteLength) {
      if (this.used === this.page.byteLength) {
        this.page = Buffer.allocUnsafe(Math.min(IoLimit.ChunkBytes, this.maximum - this.size));
        this.pages.push(this.page);
        this.used = 0;
      }
      const count = Math.min(chunk.byteLength - offset, this.page.byteLength - this.used);
      this.page.set(chunk.subarray(offset, offset + count), this.used);
      this.used += count;
      this.size += count;
      offset += count;
    }
  }

  finish(): Buffer {
    return Buffer.concat(this.pages, this.size);
  }
}
