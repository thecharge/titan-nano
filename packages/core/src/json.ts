import { DataKind, ErrorCode, JsonEncoding, JsonToken } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { StreamMessage } from "@titan/messages";
import { validateByteLimit } from "./bytes.ts";

export function invalidJson(): TitanError {
  return new TitanError(ErrorCode.JsonEncoding, StreamMessage.InvalidJson);
}

export function ownJsonValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || descriptor.get || descriptor.set) throw invalidJson();
  return descriptor.value;
}

export function* jsonStringChunks(value: string): Generator<string> {
  yield JsonToken.Quote;
  let offset = 0;
  while (offset < value.length) {
    let end = Math.min(value.length, offset + JsonEncoding.ChunkCharacters);
    const last = value.charCodeAt(end - 1);
    const next = value.charCodeAt(end);
    if (
      last >= JsonEncoding.HighStart &&
      last <= JsonEncoding.HighEnd &&
      next >= JsonEncoding.LowStart &&
      next <= JsonEncoding.LowEnd
    )
      end--;
    yield JSON.stringify(value.slice(offset, end)).slice(1, -1);
    offset = end;
  }
  yield JsonToken.Quote;
}

class JsonByteCounter {
  private size = 0;
  private ancestors: WeakSet<object> | null = null;

  constructor(private maximum: number) {
    validateByteLimit(maximum);
  }

  private append(size: number): void {
    this.size += size;
    if (this.size > this.maximum)
      throw new TitanError(ErrorCode.StreamLimit, StreamMessage.Exceeded);
  }

  private string(value: string): void {
    if (value.length <= JsonEncoding.ChunkCharacters) {
      this.append(Buffer.byteLength(JSON.stringify(value)));
      return;
    }
    for (const chunk of jsonStringChunks(value)) this.append(Buffer.byteLength(chunk));
  }

  private array(value: unknown[], depth: number): void {
    this.append(JsonToken.ArrayStart.length);
    for (let index = 0; index < value.length; index++) {
      if (index) this.append(JsonToken.Comma.length);
      this.value(ownJsonValue(value, String(index)), depth + 1);
    }
    this.append(JsonToken.ArrayEnd.length);
  }

  private object(value: object, depth: number): void {
    this.append(JsonToken.ObjectStart.length);
    let count = 0;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (count++) this.append(JsonToken.Comma.length);
      this.string(key);
      this.append(JsonToken.Colon.length);
      this.value(ownJsonValue(value, key), depth + 1);
    }
    this.append(JsonToken.ObjectEnd.length);
  }

  private structured(value: object, depth: number): void {
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== (array ? Array.prototype : Object.prototype))
      throw invalidJson();
    this.ancestors ??= new WeakSet<object>();
    const ancestors = this.ancestors;
    if (depth >= JsonEncoding.MaximumDepth || ancestors.has(value)) throw invalidJson();
    ancestors.add(value);
    try {
      if (Array.isArray(value)) this.array(value, depth);
      else this.object(value, depth);
    } finally {
      ancestors.delete(value);
    }
  }

  value(value: unknown, depth: number): void {
    if (typeof value === DataKind.String) this.string(value as string);
    else if (
      value === null ||
      typeof value === DataKind.Boolean ||
      (typeof value === DataKind.Number && Number.isFinite(value))
    )
      this.append(JSON.stringify(value).length);
    else if (typeof value === DataKind.Object && value !== null)
      this.structured(value as object, depth);
    else throw invalidJson();
  }

  finish(): number {
    return this.size;
  }
}

export function jsonByteLength(value: unknown, maximum: number): number {
  const counter = new JsonByteCounter(maximum);
  counter.value(value, 0);
  return counter.finish();
}
