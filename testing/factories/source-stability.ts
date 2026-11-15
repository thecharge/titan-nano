import { strict as assert } from "node:assert";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ErrorCode, SnapshotMutation } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { sourceChunks } from "@titan/workspace";
import { openDirectoryFiles } from "../support/descriptors.ts";

export async function sourceStability(mutation: SnapshotMutation, size: number) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, "source.bin");
    const bytes = Buffer.alloc(size, 41);
    await writeFile(path, bytes);
    const stream = sourceChunks(path, false);
    const first = await stream.next();
    assert.equal(first.done, size === 0);
    if (mutation === SnapshotMutation.Changed) await writeFile(path, Buffer.alloc(size, 42));
    if (mutation === SnapshotMutation.Grown) await writeFile(path, Buffer.alloc(size + 1, 41));
    if (mutation === SnapshotMutation.Deleted) await rm(path);
    if (mutation === SnapshotMutation.Metadata) {
      const replacement = resolve(root, "replacement.bin");
      await writeFile(replacement, bytes);
      await rename(replacement, path);
    }
    let total = first.value?.length ?? 0;
    const failure = await thrownBy(async () => {
      for await (const chunk of stream) total += chunk.length;
    });
    assert.equal(await openDirectoryFiles(root), 0);
    if (mutation === SnapshotMutation.None) {
      assert.equal(total, size);
      assert.deepEqual(await readFile(path), bytes);
      assert.equal(failure, undefined);
    } else {
      assert.ok(failure instanceof TitanError);
      assert.equal(failure.code, ErrorCode.SnapshotChanged);
    }
    return { refused: failure !== undefined, descriptors: 0 };
  });
}
