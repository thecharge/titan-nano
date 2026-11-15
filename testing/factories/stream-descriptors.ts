import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, BoardFile, StreamDescriptorFixture } from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { validateWorkflow } from "@titan/workflow";
import { sourceChunks } from "@titan/workspace";
import { createFakeBackend } from "../support/backend.ts";
import { openDirectoryFiles } from "../support/descriptors.ts";

export async function streamDescriptors(
  journal: boolean,
  stop = false,
  fail = false,
  empty = false,
) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, "source.bin");
    await writeFile(path, empty ? Buffer.alloc(0) : Buffer.from("Descriptor lifetime"));
    const run = await new Engine(() => createFakeBackend()).create({
      project: root,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(root, "home"), project: root }),
      backend: Backend.Fake,
      client_id: "descriptors",
      submission_id: "one",
    });
    const store = new RunStore(run.root);
    if (journal && empty) await writeFile(resolve(run.root, BoardFile.Journal), Buffer.alloc(0));
    for (let index = 0; index < StreamDescriptorFixture.Iterations; index++) {
      const failure = new Error("Consumer stopped the stream");
      let seen = 0;
      const error = await thrownBy(async () => {
        const source = journal ? store.events() : sourceChunks(path, false);
        for await (const chunk of source) {
          assert.ok(chunk);
          seen++;
          if (fail) throw failure;
          if (stop) break;
        }
      });
      assert.equal(seen, empty ? 0 : 1);
      assert.equal(error, fail ? failure : undefined);
    }
    return openDirectoryFiles(root);
  });
}
