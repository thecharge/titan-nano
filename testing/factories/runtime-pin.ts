import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardFile,
  ErrorCode,
  IoLimit,
  Newline,
  Packaging,
  RunEventKind,
  RunFormat,
  RuntimePinFixture,
  RuntimePinMutation,
  TitanRelease,
} from "@titan/constants";
import { RunRuntimeError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type Run, RunEventSchema, RunSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";
import { legacyEngineRun } from "./legacy-run.ts";
import { runCompatibility } from "./run-compatibility.ts";

function mutatePin(run: Run, mutation: RuntimePinMutation) {
  if (mutation === RuntimePinMutation.Release) run.runtime_version = RuntimePinFixture.OtherRelease;
  if (mutation === RuntimePinMutation.Missing) delete run.runtime_version;
  if (mutation === RuntimePinMutation.Downgrade) {
    delete run.runtime_version;
    run.schema_version = RunFormat.Legacy;
  }
  if (mutation === RuntimePinMutation.Empty) run.runtime_version = "";
}

export async function runtimePin(
  mutation: RuntimePinMutation,
  journal: boolean,
  caller: boolean,
  initial = false,
) {
  return withTemporaryDirectory(async (project) => {
    const config = await resolveConfig({ home: resolve(project, RuntimePinFixture.Home), project });
    const engine = new Engine(createFakeBackend);
    const run = await engine.create({
      project,
      config,
      plan: validateWorkflow(checkedWorkflow()),
      backend: Backend.Fake,
      client_id: RuntimePinFixture.Client,
      submission_id: RuntimePinFixture.Client,
      ...(caller ? { harness_session_id: RuntimePinFixture.Client } : {}),
    });
    assert.equal(run.schema_version, RunFormat.PinnedRuntime);
    assert.equal(run.runtime_version, TitanRelease);
    await engine.start(run.run_id);
    const store = new RunStore(run.root);
    const original = await store.read();
    const candidate = structuredClone(original);
    mutatePin(candidate, mutation);
    const path = resolve(run.root, BoardFile.Journal);
    const projection = resolve(run.root, BoardFile.State);
    let bytes = await readFileBytes(path, IoLimit.ResponseBytes);
    const saved = await readFileBytes(projection, IoLimit.ResponseBytes);
    if (journal) {
      const lines = bytes.toString().trimEnd().split(Newline);
      const changed = lines.map((line, index) =>
        pinRecord(line, mutation, initial || index === lines.length - 1),
      );
      bytes = Buffer.from(changed.join(Newline) + Newline + RuntimePinFixture.Tail);
      await writeFile(path, bytes);
    }
    const failure = await thrownBy(() =>
      journal ? new RunStore(run.root).read() : store.commit(candidate, RunEventKind.Restart),
    );
    if (mutation === RuntimePinMutation.None) {
      assert.equal(failure, undefined);
      const recovered = await new RunStore(run.root).read();
      assert.equal(recovered.runtime_version, TitanRelease);
      assert.equal(recovered.schema_version, RunFormat.CaptureReceipts);
      assert.equal(recovered.harness_session_id, run.harness_session_id);
      assert.deepEqual(recovered.nodes, run.nodes);
      assert.equal(
        RunSchema.safeParse({ ...run, schema_version: RunFormat.Legacy }).success,
        false,
      );
      return true;
    }
    const expected =
      mutation === RuntimePinMutation.Release
        ? ErrorCode.UnsupportedRunRuntime
        : ErrorCode.CorruptBoard;
    assert(failure);
    assert.equal(Reflect.get(Object(failure), "code"), expected);
    assert.deepEqual(await readFileBytes(path, IoLimit.ResponseBytes), bytes);
    assert.deepEqual(await readFileBytes(projection, IoLimit.ResponseBytes), saved);
    assert.deepEqual(await store.snapshot(), original);
    if (mutation === RuntimePinMutation.Release) {
      assert(failure instanceof Error);
      assert(failure.message.includes(RuntimePinFixture.OtherRelease));
      assert(failure.message.includes(TitanRelease));
      assert(failure.message.includes(RuntimePinFixture.RecoveryInstruction));
    }
    if (journal) {
      const restored = new Engine(createFakeBackend);
      assert(await thrownBy(() => restored.load(run.root)));
      assert.equal(restored.has(run.run_id), false);
      assert(
        await thrownBy(async () => {
          for await (const event of new RunStore(run.root).events()) assert(event.id > 0);
        }),
      );
      assert.deepEqual(await readFileBytes(path, IoLimit.ResponseBytes), bytes);
      assert.deepEqual(await readFileBytes(projection, IoLimit.ResponseBytes), saved);
    } else {
      await store.commit(original, RunEventKind.Restart);
      assert.equal((await new RunStore(run.root).read()).runtime_version, TitanRelease);
    }
    return true;
  });
}

export async function runtimePinProcess(
  caller: boolean,
  version: string | null,
  code: ErrorCode | null,
  cli = resolve(Packaging.CliSource),
) {
  return runCompatibility(RunFormat.PinnedRuntime, code, cli, version, caller);
}

function pinRecord(line: string, mutation: RuntimePinMutation, changed: boolean) {
  const event = RunEventSchema.parse(JSON.parse(line));
  if (changed) mutatePin(event.state, mutation);
  return JSON.stringify(event);
}

export async function legacyPinSchema(format: number, caller: boolean) {
  return withTemporaryDirectory(async (project) => {
    const { run } = await legacyEngineRun(createFakeBackend, {
      project,
      config: await resolveConfig({ home: resolve(project, RuntimePinFixture.Home), project }),
      plan: validateWorkflow(checkedWorkflow()),
      backend: Backend.Fake,
      client_id: RuntimePinFixture.Client,
      submission_id: RuntimePinFixture.Client,
      ...(caller ? { harness_session_id: RuntimePinFixture.Client } : {}),
    });
    Reflect.set(run, "schema_version", format);
    return RunSchema.safeParse(run).success;
  });
}

export async function runtimeBuildPin(mode: string) {
  return withTemporaryDirectory(async (project) => {
    const build = "a".repeat(64);
    const config = await resolveConfig({ home: resolve(project, RuntimePinFixture.Home), project });
    const engine = new Engine(createFakeBackend, {}, { runtimeBuild: build });
    const run = await engine.create({
      project,
      config,
      plan: validateWorkflow(checkedWorkflow()),
      backend: Backend.Fake,
      client_id: RuntimePinFixture.Client,
      submission_id: RuntimePinFixture.Client,
    });
    assert.equal(run.schema_version, RunFormat.PinnedBuild);
    assert.equal(run.runtime_build, build);
    const path = resolve(run.root, BoardFile.Journal);
    const saved = await readFileBytes(path, IoLimit.ResponseBytes);
    const expected = mode === "matching" ? build : mode === "unavailable" ? null : "b".repeat(64);
    const reader = new RunStore(run.root, undefined, expected);
    if (mode === "matching" || mode === "inspect") {
      const recovered =
        mode === "inspect" ? await reader.inspectCopy(run.root, null) : await reader.read();
      assert.equal(recovered.runtime_build, build);
    } else if (mode === "changed") {
      const store = new RunStore(run.root);
      await store.read();
      const failure = await thrownBy(() =>
        store.commit({ ...run, runtime_build: "b".repeat(64) }, RunEventKind.Restart),
      );
      assert(failure);
      assert.equal(Reflect.get(Object(failure), "code"), ErrorCode.CorruptBoard);
    } else {
      const failure = await thrownBy(() => reader.read());
      assert(failure instanceof RunRuntimeError);
      assert.equal(failure.requiredBuild, build);
      assert.equal(failure.requiredRuntime, TitanRelease);
      const restored = new Engine(
        createFakeBackend,
        {},
        expected ? { runtimeBuild: expected } : {},
      );
      await assert.rejects(() => restored.load(run.root), {
        code: ErrorCode.UnsupportedRunRuntime,
      });
    }
    assert.deepEqual(await readFileBytes(path, IoLimit.ResponseBytes), saved);
    return true;
  });
}
