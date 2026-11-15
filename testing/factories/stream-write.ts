import { strict as assert } from "node:assert";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { atomicWrite, atomicWriteStream } from "@titan/board";
import { IoLimit } from "@titan/constants";
import { hash } from "@titan/core";
import { jsonStream, readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";

export async function streamWrite(value: unknown, encodingMaximum: number, writeMaximum: number) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, "data.json");
    const previous = Buffer.from("Previous committed bytes");
    await atomicWrite(path, previous);
    let started = false;
    let closed = false;
    let first: Uint8Array | undefined;
    let firstHash: string | undefined;
    async function* source() {
      started = true;
      try {
        for await (const chunk of jsonStream(value, encodingMaximum)) {
          assert.ok(chunk.byteLength > 0 && chunk.byteLength <= IoLimit.ChunkBytes);
          if (!first) {
            first = chunk;
            firstHash = hash(chunk);
          }
          yield chunk;
        }
      } finally {
        closed = true;
      }
    }
    try {
      await atomicWriteStream(path, source(), writeMaximum);
    } catch (error) {
      assert.deepEqual(await readFileBytes(path, IoLimit.AddressBytes), previous);
      assert.deepEqual(await readdir(root), ["data.json"]);
      assert.equal(closed, started);
      throw error;
    }
    assert.ok(started && closed && first);
    assert.equal(hash(first), firstHash);
    const bytes = await readFileBytes(path, writeMaximum);
    assert.equal(bytes.toString(), JSON.stringify(value));
    assert.deepEqual(JSON.parse(bytes.toString()), value);
    assert.deepEqual(await readdir(root), ["data.json"]);
    return true;
  });
}
