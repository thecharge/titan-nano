import { DataKind, ErrorCode, IoLimit, JsonEncoding, JsonToken } from "@titan/constants";
import { invalidJson, jsonStringChunks, ownJsonValue } from "@titan/core";
import { TitanError } from "@titan/errors";
import { StreamMessage } from "@titan/messages";
import { ByteCollector, validateByteLimit } from "./buffer.ts";

function* arrayChunks(
  value: unknown[],
  ancestors: WeakSet<object>,
  depth: number,
): Generator<string> {
  yield JsonToken.ArrayStart;
  for (let index = 0; index < value.length; index++) {
    if (index) yield JsonToken.Comma;
    yield* jsonChunks(ownJsonValue(value, String(index)), ancestors, depth + 1);
  }
  yield JsonToken.ArrayEnd;
}

function* objectChunks(
  value: object,
  ancestors: WeakSet<object>,
  depth: number,
): Generator<string> {
  yield JsonToken.ObjectStart;
  let count = 0;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    if (count++) yield JsonToken.Comma;
    yield* jsonStringChunks(key);
    yield JsonToken.Colon;
    yield* jsonChunks(ownJsonValue(value, key), ancestors, depth + 1);
  }
  yield JsonToken.ObjectEnd;
}

function* jsonChunks(value: unknown, ancestors: WeakSet<object>, depth: number): Generator<string> {
  if (typeof value === DataKind.String) {
    yield* jsonStringChunks(value as string);
    return;
  }
  if (
    value === null ||
    typeof value === DataKind.Boolean ||
    (typeof value === DataKind.Number && Number.isFinite(value))
  ) {
    yield JSON.stringify(value);
    return;
  }
  if (typeof value !== DataKind.Object || value === null) throw invalidJson();
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== (array ? Array.prototype : Object.prototype))
    throw invalidJson();
  if (depth >= JsonEncoding.MaximumDepth || ancestors.has(value as object)) throw invalidJson();
  ancestors.add(value as object);
  try {
    if (Array.isArray(value)) yield* arrayChunks(value, ancestors, depth);
    else yield* objectChunks(value as object, ancestors, depth);
  } finally {
    ancestors.delete(value as object);
  }
}

export async function jsonBytes(value: unknown, maximum: number): Promise<Buffer> {
  const collector = new ByteCollector(maximum);
  for (const chunk of jsonChunks(value, new WeakSet(), 0)) collector.append(Buffer.from(chunk));
  return collector.finish();
}

class JsonStreamEncoder {
  private page: Buffer;
  private used = 0;
  private size = 0;
  constructor(private maximum: number) {
    validateByteLimit(maximum);
    this.page = Buffer.allocUnsafe(Math.min(IoLimit.ChunkBytes, maximum));
  }

  *append(token: string): Generator<Uint8Array> {
    const bytes = Buffer.from(token);
    this.size += bytes.byteLength;
    if (this.size > this.maximum)
      throw new TitanError(ErrorCode.StreamLimit, StreamMessage.Exceeded);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = Math.min(bytes.byteLength - offset, this.page.byteLength - this.used);
      this.page.set(bytes.subarray(offset, offset + count), this.used);
      this.used += count;
      offset += count;
      if (this.used === this.page.byteLength) {
        yield this.page;
        this.page = Buffer.allocUnsafe(Math.min(IoLimit.ChunkBytes, this.maximum));
        this.used = 0;
      }
    }
  }

  *finish(): Generator<Uint8Array> {
    if (this.used) yield this.page.subarray(0, this.used);
  }
}

export async function* jsonStream(value: unknown, maximum: number): AsyncGenerator<Uint8Array> {
  const encoder = new JsonStreamEncoder(maximum);
  for (const token of jsonChunks(value, new WeakSet(), 0)) yield* encoder.append(token);
  yield* encoder.finish();
}

export { jsonByteLength } from "@titan/core";
