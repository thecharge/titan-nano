import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { atomicWrite } from "@titan/board";
import { FileEncoding, HandChange } from "@titan/constants";
import { RunWrittenFilesSchema } from "@titan/types";
import { exists } from "@titan/workspace";

let queue: Promise<void> = Promise.resolve();

async function update(project: string, paths: readonly string[]): Promise<void> {
  const record = resolve(project, HandChange.RunRecord);
  const known = (await exists(record))
    ? RunWrittenFilesSchema.parse(JSON.parse(await readFile(record, FileEncoding.Utf8)))
    : [];
  const merged = [...new Set([...known, ...paths])].sort();
  await mkdir(dirname(record), { recursive: true });
  await atomicWrite(record, JSON.stringify(merged));
}

export function recordWrittenFiles(project: string, paths: readonly string[]): Promise<void> {
  const next = () => update(project, paths);
  queue = queue.then(next, next);
  return queue;
}
