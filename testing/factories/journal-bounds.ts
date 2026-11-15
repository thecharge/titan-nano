import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, BoardFile, BoardLimit, Newline, TextSymbol } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { openDirectoryFiles } from "../support/descriptors.ts";

export function journalBounds(oversized: boolean, terminated: boolean) {
  return withTemporaryDirectory(async (root) => {
    const run = await new Engine(() => createFakeBackend()).create({
      project: root,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(root, "home"), project: root }),
      backend: Backend.Fake,
      client_id: "journal-bounds",
      submission_id: "one",
    });
    const path = resolve(run.root, BoardFile.Journal);
    const original = await readFileBytes(path, BoardLimit.RecordBytes);
    const width = Buffer.byteLength(Newline);
    assert.equal(original.subarray(-width).toString(), Newline);
    const size = BoardLimit.RecordBytes + Number(oversized);
    const ending = terminated ? Buffer.from(Newline) : Buffer.alloc(0);
    const content = Buffer.alloc(size + ending.length, TextSymbol.Space);
    original.subarray(0, -width).copy(content);
    ending.copy(content, size);
    await writeFile(path, content);
    let count = 0;
    const consume = async () => {
      for await (const _event of new RunStore(run.root).events()) count++;
    };
    const error = await thrownBy(consume);
    assert.ok(error === undefined || error instanceof TitanError);
    assert.deepEqual(await readFileBytes(path, content.length), content);
    return {
      code: error instanceof TitanError ? error.code : null,
      count,
      descriptors: await openDirectoryFiles(root),
    };
  });
}
