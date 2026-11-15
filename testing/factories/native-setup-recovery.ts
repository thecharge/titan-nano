import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { initialPhase, RunStore } from "@titan/board";
import { createSecretScanner, resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  ExecutionDelivery,
  ExecutionPhase,
  IoLimit,
  NativeSetupFixture,
  NativeToolRole,
  RunEventKind,
  RunStatus,
} from "@titan/constants";
import { newId } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { jsonBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type AgentBackend,
  type NativeToolExecutionOwner,
  PhaseSchema,
  type Run,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";

export async function nativeSetupRecovery(
  mode: NativeSetupFixture,
  worker: boolean,
  reload: boolean,
) {
  return withTemporaryDirectory((project) => nativeSetupAtRoot(project, mode, worker, reload));
}

async function nativeSetupAtRoot(
  project: string,
  mode: NativeSetupFixture,
  worker: boolean,
  reload: boolean,
) {
  const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
  const role = worker ? NativeToolRole.Worker : NativeToolRole.Checker;
  let refused = false;
  let dispatched = 0;
  let active = false;
  let previous: string | null = null;
  const fail = () => {
    refused = true;
    throw new OperationalError(ErrorCode.PermissionDenied, "Native setup refused");
  };
  const owner: NativeToolExecutionOwner = {
    open(scope, current, directory) {
      assert.equal(current(), true);
      assert.equal(active, false);
      if (
        scope.role === role &&
        mode !== NativeSetupFixture.Validation &&
        !refused &&
        mode !== NativeSetupFixture.Dispatch
      )
        fail();
      if (scope.role === role) {
        assert.notEqual(scope.execution_id, previous);
        previous = scope.execution_id;
      }
      active = true;
      const connection = { ...nativeBridgeConnection(scope.role, directory), scope };
      const launch = { command: process.execPath, args: [] };
      const scanner = () => createSecretScanner({});
      return {
        binding: { connection, launch },
        scanner,
        guard: async (value) => scanner().accept(await jsonBytes(value, IoLimit.DataBytes)),
        close: async () => {
          assert.equal(active, true);
          active = false;
        },
      };
    },
  };
  const fake = createFakeBackend();
  const backend: AgentBackend = {
    id: fake.id,
    specificationVersion: fake.specificationVersion,
    capabilities: fake.capabilities,
    async validateTurn(spec, _prompt, _session, binding) {
      if (
        spec.invocation_id.endsWith(key) &&
        binding &&
        mode === NativeSetupFixture.Validation &&
        !refused
      )
        fail();
    },
    async start(spec) {
      if (spec.invocation_id.endsWith(key)) {
        const saved = await RunStore.forRun(project, spec.run_id).read();
        const proof = setupPhase(saved, key);
        assert.equal(proof.delivery, ExecutionDelivery.Uncertain);
        assert.equal(proof.dispatches, dispatched + 1);
        assert.equal(proof.execution_id, spec.execution_id);
        dispatched++;
        if (mode === NativeSetupFixture.Dispatch) fail();
      }
      return fake.start(spec);
    },
    resume: fake.resume.bind(fake),
  };
  const factory = () => backend;
  const services = { nativeTools: owner };
  let engine = new Engine(factory, {}, services);
  const recovery = { max_retries: mode === NativeSetupFixture.Exhausted ? 0 : 1 };
  const config = await resolveConfig({
    home: resolve(project, "home"),
    project,
    overrides: { recovery },
  });
  const run = await engine.create({
    project,
    plan: validateWorkflow(vendorRecoveryWorkflow()),
    config,
    backend: Backend.Fake,
    client_id: "native-setup",
    submission_id: "one",
  });
  await engine.start(run.run_id);
  assert.equal(active, false);
  const before = await engine.snapshot(run.run_id);
  const initial = setupPhase(before, key);
  assert.equal(before.state, RunStatus.Blocked);
  assert.equal(initial.executions, 1);
  assert.equal(initial.retries, 0);
  assert.equal(initial.dispatches, mode === NativeSetupFixture.Dispatch ? 1 : 0);
  assert.equal(
    (await engine.usage(run.run_id)).executions,
    worker ? initial.dispatches : 1 + initial.dispatches,
  );
  assert.equal(initial.session_id, null);
  assert.equal(
    initial.delivery,
    mode === NativeSetupFixture.Dispatch ? ExecutionDelivery.Uncertain : ExecutionDelivery.Prepared,
  );
  if (mode === NativeSetupFixture.Legacy) {
    const store = new RunStore(run.root);
    const legacy = await store.read();
    delete setupPhase(legacy, key).delivery;
    delete setupPhase(legacy, key).dispatches;
    await store.commit(legacy, RunEventKind.ExecutionBlocked);
  }
  if (reload) {
    engine = new Engine(factory, {}, services);
    await engine.load(run.root);
  }
  await engine.resume(run.run_id);
  assert.equal(active, false);
  const result = await engine.snapshot(run.run_id);
  const phase = setupPhase(result, key);
  const recovered = mode === NativeSetupFixture.Owner || mode === NativeSetupFixture.Validation;
  assert.equal(result.state, recovered ? RunStatus.Passed : RunStatus.Blocked);
  assert.equal(phase.executions, recovered ? 2 : 1);
  assert.equal(phase.retries, recovered ? 1 : 0);
  const usage = await engine.usage(run.run_id);
  assert.equal(
    usage.executions,
    recovered
      ? 2
      : (worker ? 0 : 1) +
          (mode === NativeSetupFixture.Dispatch || mode === NativeSetupFixture.Legacy ? 1 : 0),
  );
  assert.equal(
    usage.unreported_executions,
    mode === NativeSetupFixture.Dispatch || mode === NativeSetupFixture.Legacy ? 1 : 0,
  );
  assert.equal(dispatched, recovered || mode === NativeSetupFixture.Dispatch ? 1 : 0);
  if (!recovered) assert.equal(phase.execution_id, initial.execution_id);
  assert.equal(result.nodes.deliver?.attempt, 1);
  assert.equal(result.nodes.deliver?.refutations, 0);
  assert.deepEqual(result.nodes.deliver?.evidence, []);
  return true;
}

function setupPhase(run: Run, key: string) {
  const phase = run.nodes.deliver?.phases[key];
  assert.ok(phase);
  return phase;
}

export function nativeSetupRecord(delivery: unknown, dispatches: unknown) {
  return PhaseSchema.safeParse({
    ...initialPhase(),
    execution_id: newId(),
    executions: 1,
    delivery,
    dispatches,
  }).success;
}
