import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { atomicWrite, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  BoardFile,
  BoardLimit,
  ErrorCode,
  ExecutionPhase,
  FileEncoding,
  IoLimit,
  Newline,
  RequestDecision,
  RequestExecutionFixture,
  RequestFormat,
  RequestKind,
  RunEventKind,
  RunFormat,
  RunStatus,
  TaskOutcome,
  Verdict,
} from "@titan/constants";
import { settle } from "@titan/core";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type OperationRequest,
  OperationRequestInputSchema,
  OperationRequestSchema,
  type Run,
  RunEventSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { legacyEngineRun } from "./legacy-run.ts";

async function requestAppendRace(
  engine: Engine,
  run: Run,
  open: () => Promise<OperationRequest>,
  finish: () => Promise<void>,
) {
  const original = RunStore.prototype.snapshot;
  const release = Promise.withResolvers<void>();
  let reads = 0;
  let held = false;
  let selected: RunStore | undefined;
  RunStore.prototype.snapshot = async function () {
    const snapshot = await original.call(this);
    if (this.root === run.root && ++reads === 2) {
      held = true;
      selected = this;
      await release.promise;
    }
    return snapshot;
  };
  const pending = settle([open]);
  try {
    assert.ok(await waitUntil(async () => held));
    await finish();
    assert.equal(run.state, RunStatus.Passed);
    assert.ok(selected);
    const before = await original.call(selected);
    release.resolve();
    const results = await pending;
    assert.equal(results[0]?.status, TaskOutcome.Rejected);
    const failure = results[0];
    assert.ok(failure?.status === TaskOutcome.Rejected);
    assert.equal(Reflect.get(Object(failure.reason), "code"), ErrorCode.PermissionDenied);
    assert.deepEqual(await original.call(selected), before);
    assert.equal((await engine.requests.list(run.run_id)).length, 0);
    assert.equal(run.schema_version, RunFormat.CaptureReceipts);
    return true;
  } finally {
    release.resolve();
    await pending;
    RunStore.prototype.snapshot = original;
  }
}

async function requestWriteAdmission(
  engine: Engine,
  run: Run,
  open: () => Promise<OperationRequest>,
  checker: boolean,
) {
  const node = run.nodes.deliver;
  assert.ok(node);
  const before = await engine.snapshot(run.run_id);
  const evidence = node.evidence;
  try {
    node.evidence = ["x".repeat(BoardLimit.RecordBytes)];
    const failure = await thrownBy(open);
    assert.ok(failure);
    assert.equal(Reflect.get(Object(failure), "code"), ErrorCode.DurableWrite);
    assert.equal(run.schema_version, checker ? RunFormat.CaptureReceipts : RunFormat.Legacy);
    assert.deepEqual(await engine.snapshot(run.run_id), before);
  } finally {
    node.evidence = evidence;
  }
  assert.equal((await engine.requests.list(run.run_id)).length, 0);
  const retried = await open();
  assert.equal(retried.schema_version, RequestFormat.Execution);
  assert.equal(
    run.schema_version,
    checker ? RunFormat.CaptureReceipts : RunFormat.ExecutionRequests,
  );
  return true;
}

async function forgeRequestOrigin(run: Run) {
  const path = resolve(run.root, BoardFile.Journal);
  const bytes = await readFileBytes(path, IoLimit.ResponseBytes);
  const lines = bytes.toString(FileEncoding.Utf8).trimEnd().split(Newline);
  let forged = false;
  const changed = lines.map((line) => {
    const event = RunEventSchema.parse(JSON.parse(line));
    if (event.type !== RunEventKind.RequestOpened) return line;
    const request = OperationRequestSchema.parse(event.data);
    assert.ok(request.origin.execution);
    request.origin.execution.execution_id = "forged-execution";
    event.data = request;
    forged = true;
    return JSON.stringify(event);
  });
  assert.ok(forged);
  await atomicWrite(path, Buffer.from(changed.join(Newline) + Newline));
}

export function executionRequest(run: Run, step_id: string, phase: string) {
  const state = run.nodes[step_id];
  const current = state?.phases[phase];
  assert.ok(state && current?.execution_id && current.session_id);
  const execution = { step_id, attempt: state.attempt, phase, execution_id: current.execution_id };
  const origin = { client_id: run.client_id, harness_session_id: current.session_id, execution };
  const scope = {
    operation: "inspect",
    resource: "candidate",
    content_hashes: {},
    arguments: [],
    environment_names: [],
  };
  return OperationRequestInputSchema.parse({
    request_id: "phase-request",
    kind: RequestKind.Tool,
    scope,
    origin,
    expires_at: Date.now() + 60000,
  });
}

export async function requestExecution(mode: RequestExecutionFixture, checker: boolean) {
  return withTemporaryDirectory((project) => requestExecutionAtRoot(project, mode, checker));
}

async function requestExecutionAtRoot(
  project: string,
  ...args: Parameters<typeof requestExecution>
) {
  const [mode, checker] = args;
  let entered = false;
  const release = Promise.withResolvers<void>();
  const phaseKey = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
  const backend = new FakeBackend(async (spec) => {
    if (spec.invocation_id.endsWith(`/${phaseKey}`)) {
      entered = true;
      await release.promise;
    }
    return {
      json: spec.invocation_id.endsWith(`/${ExecutionPhase.Worker}`)
        ? { ok: true, marker: "candidate", turn: 1 }
        : { verdict: Verdict.Survived, evidence: "Checked candidate" },
    };
  });
  const factory = () => backend;
  const config = await resolveConfig({ home: resolve(project, "home"), project });
  const { engine, run } = await legacyEngineRun(factory, {
    project,
    config,
    plan: validateWorkflow(vendorRecoveryWorkflow()),
    backend: Backend.Fake,
    client_id: "phase-client",
    submission_id: "phase-submission",
  });
  const running = settle([() => engine.start(run.run_id)]);
  try {
    assert.ok(await waitUntil(async () => entered));
    const state = await engine.snapshot(run.run_id);
    const phase = state.nodes.deliver?.phases[phaseKey];
    assert.ok(phase?.execution_id);
    assert.ok(phase.session_id);
    const input = executionRequest(state, "deliver", phaseKey);
    assert.ok(input.origin.execution);
    if (mode === RequestExecutionFixture.Step) input.origin.execution.step_id = "other-step";
    if (mode === RequestExecutionFixture.Attempt) input.origin.execution.attempt++;
    if (mode === RequestExecutionFixture.Phase)
      input.origin.execution.phase = checker
        ? ExecutionPhase.Worker
        : `${ExecutionPhase.FalsifierPrefix}0`;
    if (mode === RequestExecutionFixture.Execution)
      input.origin.execution.execution_id = "other-execution";
    if (mode === RequestExecutionFixture.Session) input.origin.harness_session_id = "other-session";
    if (mode === RequestExecutionFixture.Client) input.origin.client_id = "other-client";
    const parsed = OperationRequestInputSchema.parse(input);
    const before = await engine.snapshot(run.run_id);
    if (mode === RequestExecutionFixture.Completed) {
      release.resolve();
      await running;
    }
    const opening = () => engine.requests.open(run.run_id, parsed);
    if (mode === RequestExecutionFixture.WriteAdmission)
      return await requestWriteAdmission(engine, run, opening, checker);
    if (mode === RequestExecutionFixture.AppendRace)
      return await requestAppendRace(engine, run, opening, async () => {
        release.resolve();
        await running;
      });
    if (
      ![
        RequestExecutionFixture.Open,
        RequestExecutionFixture.Answer,
        RequestExecutionFixture.Replay,
      ].includes(mode)
    ) {
      return await refusedExecutionRequest(engine, run, opening, mode, before);
    }
    const request = await opening();
    assert.equal(request.schema_version, RequestFormat.Execution);
    assert.equal(
      run.schema_version,
      checker ? RunFormat.CaptureReceipts : RunFormat.ExecutionRequests,
    );
    assert.deepEqual(request.origin, input.origin);
    if (mode === RequestExecutionFixture.Replay) {
      release.resolve();
      await running;
      assert.equal(run.state, RunStatus.Passed);
      await forgeRequestOrigin(run);
      const restored = new Engine(factory);
      const error = await thrownBy(() => restored.load(run.root));
      assert.equal(restored.has(run.run_id), false);
      assert.ok(error);
      assert.equal(Reflect.get(Object(error), "code"), ErrorCode.CorruptBoard);
      return true;
    }
    release.resolve();
    await running;
    assert.equal(run.state, RunStatus.Passed);
    const restored = new Engine(factory);
    await restored.load(run.root);
    assert.deepEqual(await restored.requests.open(run.run_id, parsed), request);
    if (mode === RequestExecutionFixture.Answer) {
      const answered = await restored.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Approve,
          reason: "Reviewed exact phase",
        },
        { client_id: "phase-reviewer", authority: ApprovalLevel.Main },
      );
      assert.deepEqual(answered.origin, request.origin);
      assert.deepEqual(await restored.requests.open(run.run_id, parsed), answered);
    }
    return true;
  } finally {
    release.resolve();
    await running;
  }
}

async function refusedExecutionRequest(
  engine: Engine,
  run: Run,
  opening: () => Promise<OperationRequest>,
  mode: RequestExecutionFixture,
  before: Run,
) {
  const error = await thrownBy(opening);
  assert.ok(error);
  assert.equal(Reflect.get(Object(error), "code"), ErrorCode.PermissionDenied);
  assert.equal((await engine.requests.list(run.run_id)).length, 0);
  if (mode !== RequestExecutionFixture.Completed)
    assert.deepEqual(await engine.snapshot(run.run_id), before);
  return true;
}
