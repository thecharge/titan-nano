import { strict as assert } from "node:assert";
import { mkdir, open, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileHandleChunks, readBytes, readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";

export async function collectedBytes(
  length: number,
  chunkSize: number,
  maximum: number,
  fail: boolean,
) {
  let closed = false;
  let produced = 0;
  const source = async function* () {
    const bytes = Buffer.alloc(chunkSize);
    try {
      yield Buffer.alloc(0);
      for (let offset = 0; offset < length; offset += chunkSize) {
        bytes.fill(offset % 251);
        produced++;
        yield bytes.subarray(0, Math.min(chunkSize, length - offset));
      }
      if (fail) throw new Error("Interrupted byte stream");
    } finally {
      closed = true;
    }
  };
  let result: Buffer | undefined;
  const error = await thrownBy(async () => {
    result = await readBytes(source(), maximum);
  });
  const expected = Buffer.alloc(length);
  for (let offset = 0; offset < length; offset += chunkSize)
    expected.fill(offset % 251, offset, Math.min(length, offset + chunkSize));
  return {
    correct: result?.equals(expected) ?? false,
    closed,
    produced,
    code: error instanceof Error ? (Reflect.get(error, "code") ?? "interrupted") : null,
  };
}

export async function fileBytes(length: number, maximum: number, present: boolean) {
  return withTemporaryDirectory(async (root) => {
    const file = resolve(root, "bytes.bin");
    const bytes = Buffer.alloc(length, 197);
    if (present) await writeFile(file, bytes);
    return (await readFileBytes(file, maximum)).equals(bytes);
  });
}

export async function handleBytes(length: number, closed = false, directory = false) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, "handle.bin");
    const expected = Buffer.alloc(length, 197);
    if (directory) await mkdir(path);
    else await writeFile(path, expected);
    const file = await open(path, "r");
    try {
      if (closed) await file.close();
      const actual = await readBytes(fileHandleChunks(file), length + 1);
      assert.equal((await file.stat()).isFile(), true);
      return actual.equals(expected);
    } finally {
      await file.close();
    }
  });
}
