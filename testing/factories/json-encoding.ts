import { strict as assert } from "node:assert";
import { IoLimit, JsonEncoding, JsonFixture } from "@titan/constants";
import { jsonByteLength, jsonBytes } from "@titan/streams";

export function fixtureValue(mode: JsonFixture, input: unknown): unknown {
  if (mode === JsonFixture.NullObject) return Object.assign(Object.create(null), { ok: input });
  if (mode === JsonFixture.NullArray) return Object.setPrototypeOf([input], null);
  if (mode === JsonFixture.Cycle) {
    const result: Record<string, unknown> = {};
    result.self = result;
    return result;
  }
  if (mode === JsonFixture.Accessor)
    return Object.defineProperty({}, "value", { get: Date.now, enumerable: true });
  if (mode === JsonFixture.Setter)
    return Object.defineProperty({}, "value", { set: Object.freeze, enumerable: true });
  if (mode === JsonFixture.Sparse) return Array(2);
  if (mode === JsonFixture.BigInt) return 1n;
  if (mode === JsonFixture.Symbol) return Symbol();
  if (mode === JsonFixture.Function) return Date.now;
  if (mode === JsonFixture.Date) return new Date(0);
  if (mode === JsonFixture.Undefined) return undefined;
  if (mode === JsonFixture.Projection) {
    let result: unknown = Array(131072).fill(null);
    for (let index = 0; index < JsonEncoding.MaximumDepth / 2; index++) result = [result];
    return result;
  }
  if (mode === JsonFixture.Deep) {
    let result: unknown = null;
    for (let index = 0; index < Number(input); index++) result = [result];
    return result;
  }
  if (mode === JsonFixture.PairBoundary)
    return `${"x".repeat(JsonEncoding.ChunkCharacters - 1)}😀\ud800\udc00\udfff`;
  if (mode === JsonFixture.Repeated) {
    const shared = { text: "x".repeat(JsonEncoding.ChunkCharacters) };
    return Array.from({ length: Number(input) }, () => shared);
  }
  return input;
}

export async function encodedJson(
  mode: JsonFixture,
  input: unknown = null,
  maximum = IoLimit.DataBytes,
) {
  const value = fixtureValue(mode, input);
  const bytes = await jsonBytes(value, maximum);
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(bytes.toString(), JSON.stringify(value));
  return true;
}

export function measuredJson(
  mode: JsonFixture,
  input: unknown = null,
  maximum = IoLimit.DataBytes,
) {
  const value = fixtureValue(mode, input);
  const size = jsonByteLength(value, maximum);
  assert.equal(size, Buffer.byteLength(JSON.stringify(value)));
  return true;
}
