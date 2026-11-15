import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig, settingOverrides } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  ConfigFile,
  ConfigSource,
  ErrorCode,
  RequestDecision,
  RequestKind,
  RequestLimit,
  RunEventKind,
} from "@titan/constants";
import { hash } from "@titan/core";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ConfigSchema, OperationRequestSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";

export async function requestBudgetLayers(
  owner: unknown = {},
  projectSettings: unknown = {},
  workflow?: unknown,
  entries: string[] = [],
  explicit = false,
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(home);
    await mkdir(resolve(project, ConfigFile.HomeDirectory), { recursive: true });
    await writeFile(resolve(home, ConfigFile.User), Buffer.from(JSON.stringify(owner)));
    const file = resolve(project, explicit ? "selected.yaml" : ConfigFile.Project);
    await writeFile(file, Buffer.from(JSON.stringify(projectSettings)));
    const config = await resolveConfig({
      home,
      project,
      ...(explicit ? { configFile: file } : {}),
      workflow,
      overrides: settingOverrides(entries),
    });
    assert.equal(config.hash, hash(JSON.stringify(config.value)));
    assert.deepEqual(ConfigSchema.parse(config.value), config.value);
    assert.ok(config.sources["requests.max_per_run"]?.length);
    if (entries.length)
      assert.deepEqual(config.sources["requests.max_per_run"], [
        ConfigSource.BuiltIn,
        [ConfigSource.User, resolve(home, ConfigFile.User)].join(":"),
        [ConfigSource.Project, file].join(":"),
        ConfigSource.Workflow,
        ConfigSource.Cli,
      ]);
    return Reflect.get(Object(config.value.requests), "max_per_run");
  });
}

export async function requestBudget(
  limit: number,
  reload: boolean,
  overflow = false,
  legacy = false,
) {
  return withTemporaryDirectory(async (project) => {
    const home = resolve(project, "home");
    await mkdir(home);
    const workflow = {
      ...vendorRecoveryWorkflow(),
      ...(!legacy ? { requests: { max_per_run: limit } } : {}),
    };
    const config = await resolveConfig({
      home,
      project,
      workflow: { requests: workflow.requests },
    });
    if (legacy) {
      delete config.value.requests;
      delete config.value.server.max_pending_request_operations;
      delete config.value.server.max_pending_run_operations;
      delete config.value.server.max_pending_submissions;
      delete config.value.server.max_resident_runs;
      config.hash = hash(JSON.stringify(config.value));
    }
    const engine = new Engine(createFakeBackend);
    const run = await engine.create({
      project,
      config,
      plan: validateWorkflow(workflow),
      backend: Backend.Fake,
      client_id: "budget-owner",
      submission_id: "budget-run",
    });
    const input = {
      request_id: "request-0",
      kind: RequestKind.Tool,
      scope: {
        operation: "inspect",
        resource: "candidate",
        content_hashes: {},
        arguments: [],
        environment_names: [],
      },
      origin: { client_id: "budget-owner", harness_session_id: "budget-session" },
      expires_at: Date.now() + 60000,
    };
    for (let index = 0; index < limit; index++)
      await engine.requests.open(run.run_id, { ...input, request_id: `request-${index}` });
    await engine.requests.answer(
      {
        run_id: run.run_id,
        request_id: input.request_id,
        version: 1,
        decision: RequestDecision.Approve,
        reason: "Reviewed exact request",
      },
      { client_id: "reviewer", authority: ApprovalLevel.Main },
    );
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(JSON.stringify({ requests: { max_per_run: RequestLimit.PerRun } })),
    );
    const recovered = reload ? new Engine(createFakeBackend) : engine;
    const restored = reload ? await recovered.load(run.root) : run;
    assert.equal(restored.config.hash, config.hash);
    if (legacy) {
      assert.equal(Object.hasOwn(restored.config.value, "requests"), false);
      assert.equal(
        Object.hasOwn(restored.config.value.server, "max_pending_request_operations"),
        false,
      );
      assert.equal(
        Object.hasOwn(restored.config.value.server, "max_pending_run_operations"),
        false,
      );
      assert.equal(Object.hasOwn(restored.config.value.server, "max_pending_submissions"), false);
      assert.equal(Object.hasOwn(restored.config.value.server, "max_resident_runs"), false);
    }
    const before = await recovered.snapshot(run.run_id);
    const records = await recovered.requests.list(run.run_id);
    assert.equal(records.length, limit);
    assert.deepEqual(await recovered.requests.open(run.run_id, input), records[0]);
    if (overflow) {
      const failure = await thrownBy(() =>
        recovered.requests.open(run.run_id, { ...input, request_id: "excess" }),
      );
      assert.equal(Reflect.get(Object(failure), "code"), ErrorCode.Capacity);
      assert.deepEqual(await recovered.requests.list(run.run_id), records);
      assert.equal((await recovered.snapshot(run.run_id)).version, before.version);
      const store = new RunStore(run.root);
      await store.read();
      await store.commit(
        await store.snapshot(),
        RunEventKind.RequestOpened,
        OperationRequestSchema.parse({
          ...records[0],
          request_id: "forged-excess",
          version: 1,
          answer: null,
        }),
      );
      const forged = new Engine(createFakeBackend);
      const replayFailure = await thrownBy(() => forged.load(run.root));
      assert.equal(forged.has(run.run_id), false);
      assert.equal(Reflect.get(Object(replayFailure), "code"), ErrorCode.Capacity);
      return true;
    }
    if (legacy) {
      await recovered.requests.open(run.run_id, { ...input, request_id: "legacy-extra" });
      assert.equal((await recovered.requests.list(run.run_id)).length, limit + 1);
    }
    return true;
  });
}
