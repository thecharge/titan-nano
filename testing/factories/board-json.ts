import { strict as assert } from "node:assert";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, BoardFile, BoardLimit, type JsonFixture } from "@titan/constants";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { fixtureValue } from "./json-encoding.ts";

export async function storedJson(mode: JsonFixture, input: unknown = null, projection = false) {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(() => createFakeBackend());
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "board-json",
      submission_id: "one",
    });
    const store = new RunStore(run.root);
    await store.read();
    const journal = resolve(run.root, BoardFile.Journal);
    const before = (await stat(journal)).size;
    const value = fixtureValue(mode, input);
    if (projection) {
      const node = run.nodes.deliver;
      assert.ok(node);
      node.output = value;
    }
    try {
      await store.commit(run, "encoded", value);
    } catch (error) {
      assert.equal((await stat(journal)).size, before);
      assert.equal((await store.snapshot()).version, 1);
      await store.commit(run, "after-rejection");
      assert.equal((await store.snapshot()).version, 2);
      throw error;
    }
    assert.equal((await store.snapshot()).version, 2);
    let last: unknown;
    for await (const event of store.events()) last = event.data;
    assert.equal(JSON.stringify(last), JSON.stringify(value === undefined ? null : value));
    const state = await readFileBytes(resolve(run.root, BoardFile.State), BoardLimit.RecordBytes);
    assert.equal(JSON.parse(state.toString()).version, 2);
    return true;
  });
}
