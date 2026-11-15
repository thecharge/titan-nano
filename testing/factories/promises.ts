import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { OwnedSource } from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkPromises, inspectPromises } from "../../tooling/scripts/check-promises.ts";

export function promiseSyntax(source: string) {
  return inspectPromises(source);
}

export async function promiseRepository(file: string, source: string, oversized: boolean) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      oversized ? Buffer.alloc(OwnedSource.MaximumSourceBytes + 1) : Buffer.from(source),
    );
    const messages: string[] = [];
    const code = await checkPromises(root, (message) => messages.push(message));
    return { code, findings: messages.length };
  });
}
