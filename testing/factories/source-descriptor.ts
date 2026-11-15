import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { SourceDescriptorFixture } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { readBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { sourceChunks } from "@titan/workspace";
import { openDirectoryFiles } from "../support/descriptors.ts";

export async function sourceDescriptor(source: string) {
  return withTemporaryDirectory(async (root) => {
    await writeFile(resolve(root, SourceDescriptorFixture.Empty), Buffer.alloc(0));
    await writeFile(
      resolve(root, SourceDescriptorFixture.Content),
      Buffer.from(SourceDescriptorFixture.Contents),
    );
    const path = resolve(root, source);
    const parent = dirname(path);
    const before = await openDirectoryFiles(parent);
    let contents: string | null = null;
    const failure = await thrownBy(async () => {
      const bytes = await readBytes(sourceChunks(path, false), SourceDescriptorFixture.Bytes);
      contents = bytes.toString();
    });
    assert.ok(failure === undefined || failure instanceof TitanError);
    assert.equal(await openDirectoryFiles(parent), before);
    return {
      contents,
      error: failure instanceof TitanError ? failure.code : null,
      descriptors: await openDirectoryFiles(root),
    };
  });
}
