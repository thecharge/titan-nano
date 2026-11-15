import { strict as assert } from "node:assert";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, BoardFile, ConfigDefault, Newline, RunStatus } from "@titan/constants";
import { hash } from "@titan/core";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { RunEvent } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function frozenNativeBudget(legacy: boolean, tampered: boolean) {
  return withTemporaryDirectory(async (project) => {
    const config = await resolveConfig({ home: resolve(project, "home"), project });
    if (legacy) {
      delete config.value.server.agent_host.worker_threads;
      delete config.value.server.native_tools.transport;
    }
    config.hash = hash(JSON.stringify(config.value));
    const engine = new Engine(() => createFakeBackend());
    const run = await engine.create({
      project,
      plan: validateWorkflow(checkedWorkflow()),
      config,
      backend: Backend.Fake,
      client_id: "frozen-native-budget",
      submission_id: "one",
    });
    await engine.start(run.run_id);
    const store = new RunStore(run.root);
    if (tampered) await tamperBudget(store, run.root);
    const loaded = await store.read();
    assert.equal(loaded.state, RunStatus.Passed);
    assert.equal(loaded.config.hash, config.hash);
    assert.deepEqual(loaded.config.value, config.value);
    assert.equal(
      loaded.config.value.server.agent_host.worker_threads,
      legacy ? undefined : ConfigDefault.HostWorkerThreads,
    );
    assert.equal(
      loaded.config.value.server.native_tools.transport,
      legacy ? undefined : ConfigDefault.NativeTransport,
    );
    return true;
  });
}

async function tamperBudget(store: RunStore, root: string) {
  let last: RunEvent | undefined;
  for await (const event of store.events()) last = event;
  assert.ok(last);
  last.id++;
  last.state.version++;
  last.state.config.value.server.agent_host.gc_markers++;
  await appendFile(resolve(root, BoardFile.Journal), Buffer.from(JSON.stringify(last) + Newline));
}
