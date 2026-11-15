import { type FileHandle, open } from "node:fs/promises";
import { FileOpenMode, IoLimit } from "@titan/constants";
import { ByteCollector } from "./buffer.ts";

export async function readBytes(
  source: AsyncIterable<Uint8Array>,
  maximum: number,
): Promise<Buffer> {
  const collector = new ByteCollector(maximum);
  for await (const chunk of source) collector.append(chunk);
  return collector.finish();
}

export async function* fileHandleChunks(file: FileHandle): AsyncGenerator<Buffer> {
  let size = 0;
  do {
    const buffer = Buffer.allocUnsafe(IoLimit.ChunkBytes);
    const result = await file.read(buffer, 0, buffer.length, null);
    size = result.bytesRead;
    if (size) yield buffer.subarray(0, size);
  } while (size);
}

async function* fileChunks(path: string): AsyncGenerator<Buffer> {
  const file = await open(path, FileOpenMode.Read);
  try {
    yield* fileHandleChunks(file);
  } finally {
    await file.close();
  }
}

export async function readFileBytes(path: string, maximum: number): Promise<Buffer> {
  return readBytes(fileChunks(path), maximum);
}

export { validateByteLimit } from "./buffer.ts";
export { atomicWrite, atomicWriteStream } from "./files.ts";
export { jsonByteLength, jsonBytes, jsonStream } from "./json.ts";
