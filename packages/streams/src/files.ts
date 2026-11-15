import { mkdir, open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { ErrorCode, FileOpenMode, TextSymbol, WorkspaceFile } from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { StreamMessage } from "@titan/messages";
import { validateByteLimit } from "./buffer.ts";

async function atomicFile(
  path: string,
  contents: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = path + TextSymbol.Dot + newId() + WorkspaceFile.TemporarySuffix;
  const file = await open(temporary, FileOpenMode.Exclusive, 0o600);
  try {
    for await (const chunk of contents) await file.writeFile(chunk);
    await file.sync();
    await file.close();
    await rename(temporary, path);
    const parent = await open(dirname(path), FileOpenMode.Read);
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  } finally {
    await file.close();
    await rm(temporary, { force: true });
  }
}

export async function atomicWrite(path: string, contents: string | Uint8Array): Promise<void> {
  await atomicFile(path, [contents instanceof Uint8Array ? contents : Buffer.from(contents)]);
}

async function* boundedChunks(
  source: AsyncIterable<Uint8Array>,
  maximum: number,
): AsyncGenerator<Uint8Array> {
  let size = 0;
  for await (const chunk of source) {
    size += chunk.byteLength;
    if (size > maximum) throw new TitanError(ErrorCode.StreamLimit, StreamMessage.Exceeded);
    yield chunk;
  }
}

export async function atomicWriteStream(
  path: string,
  source: AsyncIterable<Uint8Array>,
  maximum: number,
): Promise<void> {
  validateByteLimit(maximum);
  await atomicFile(path, boundedChunks(source, maximum));
}
