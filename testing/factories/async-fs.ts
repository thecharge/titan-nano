import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { OwnedSource } from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  checkAsyncFileSystem,
  inspectAsyncFileSystem,
} from "../../tooling/scripts/check-async-fs.ts";

export function asyncFileSystemSyntax(source: string) {
  return inspectAsyncFileSystem(source);
}

export async function asyncFileSystemRepository(file: string, source: string, oversized = false) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      oversized ? Buffer.alloc(OwnedSource.MaximumSourceBytes + 1) : Buffer.from(source),
    );
    const messages: string[] = [];
    const code = await checkAsyncFileSystem(root, (message) => messages.push(message));
    return { code, findings: messages.length };
  });
}
