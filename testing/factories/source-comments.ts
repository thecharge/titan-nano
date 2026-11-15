import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { IoLimit } from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkSourceComments } from "../../tooling/scripts/check-source-comments.ts";

export async function sourceCommentDiscovery(file: string, comment: boolean) {
  return sourceCommentTree({ [file]: comment ? "// rationale" : "export const value = 1;" });
}

export async function sourceCommentTree(files: Record<string, string>, limits: unknown = {}) {
  return withTemporaryDirectory(async (root) => {
    for (const [file, text] of Object.entries(files)) {
      const path = resolve(root, file);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, Buffer.from(text));
    }
    const findings: string[] = [];
    try {
      const code = await checkSourceComments(root, (finding) => findings.push(finding), limits);
      return { code, findings };
    } finally {
      await unchangedSources(root, files);
    }
  });
}

async function unchangedSources(root: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files))
    assert.deepEqual(
      await readFileBytes(resolve(root, file), IoLimit.DataBytes),
      Buffer.from(text),
    );
}
