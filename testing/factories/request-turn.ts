import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
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
  RequestKind,
  RequestLimit,
  RequestTurnFixture,
  RunEventKind,
  RunFormat,
  RunStatus,
  StepStatus,
  Verdict,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { HostedBackend } from "@titan/runtime";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { processExited, thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  AgentHostSettingsSchema,
  type BackendId,
  ObjectSchema,
  RequestTurnBatchSchema,
  type Run,
  RunEventSchema,
  VendorStubCallSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { isolatedWorkspace } from "../support/isolated.ts";
import { legacyEngineRun } from "./legacy-run.ts";
import { prepareSdkProject } from "./sdk-process.ts";

export async function requestTurn(
  checker: boolean,
  reload: boolean,
  pending = false,
  invalid = false,
  backendId: BackendId = Backend.Fake,
  count = 1,
  allowance: number = RequestLimit.PerRun,
  fault: RequestTurnFixture = RequestTurnFixture.None,
  callerSession?: string,
) {
  return withTemporaryDirectory((root) =>
    requestTurnAtRoot(
      root,
      checker,
      reload,
      pending,
      invalid,
      backendId,
      count,
      allowance,
      fault,
      callerSession,
    ),
  );
}

async function requestTurnAtRoot(root: string, ...args: Parameters<typeof requestTurn>) {
  const [
    checker,
    reload,
    pending = false,
    invalid = false,
    backendId = Backend.Fake,
    count = 1,
    allowance = RequestLimit.PerRun,
    fault = RequestTurnFixture.None,
    callerSession,
  ] = args;
  const { project, home } =
    backendId === Backend.Fake
      ? { project: root, home: resolve(root, "home") }
      : await prepareSdkProject(root, backendId, 0);
  const overrides = {
    recovery: { max_retries: 0 },
    limits: { max_parallel: 2 },
    requests: { max_per_run: allowance },
  };
  const config = await resolveConfig({
    home,
    project,
    overrides: { ...isolatedWorkspace, ...overrides },
  });
  const workflow = vendorRecoveryWorkflow("complete");
  const task =
    backendId === Backend.Fake ? "complete" : invalid ? "request_turn_invalid" : "request_turn";
  const target = workflow.steps[0];
  assert.ok(target);
  const asking = {
    ...target,
    do: { ...target.do, task: checker ? "complete" : task },
    falsify: [{ ...target.falsify[0], task: checker ? task : "complete" }],
  };
  const personas = {
    worker: { ...workflow.personas.worker, request_turns: true },
    checker: { ...workflow.personas.checker, request_turns: true },
  };
  const parallel = [asking, { ...target, id: "peer" }];
  const steps = [{ parallel }, { ...workflow.steps[0], id: "dependent" }];
  const plan = validateWorkflow({
    ...workflow,
    personas,
    steps,
  });
  const selected = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
  let calls = 0;
  let delivered: unknown;
  const backend = new FakeBackend(async (spec, prompt) => {
    const normal = spec.writable
      ? { ok: true, marker: "candidate", turn: 1 }
      : { verdict: Verdict.Survived, evidence: "Checked candidate" };
    if (spec.invocation_id === `deliver/1/${selected}`) {
      calls++;
      if (calls === 1)
        return {
          json: { result: invalid ? normal : null, requests: requestTurnDescriptions(count) },
        };
      delivered = ObjectSchema.parse(JSON.parse(prompt)).request_answers;
    }
    return { json: { result: normal, requests: [] } };
  });
  const admission = Promise.withResolvers<void>();
  const releaseAdmission = Promise.withResolvers<void>();
  let holdAdmission = false;
  if (fault === RequestTurnFixture.ResumeAdmission)
    Object.assign(backend, {
      async validateTurn() {
        if (!holdAdmission) return;
        admission.resolve();
        await releaseAdmission.promise;
      },
    });
  const factory = () =>
    backendId === Backend.Fake
      ? backend
      : new HostedBackend(
          backendId,
          config.value.server.backends[backendId],
          AgentHostSettingsSchema.parse(config.value.server.agent_host),
        );
  const { engine, run } = await legacyEngineRun(factory, {
    project,
    config,
    plan,
    backend: backendId,
    client_id: "turn-owner",
    submission_id: "turn-owner",
    ...(callerSession !== undefined ? { harness_session_id: callerSession } : {}),
  });
  const original = RunStore.prototype.commit;
  RunStore.prototype.commit = function (state, kind, data) {
    if (
      this.root === run.root &&
      kind === RunEventKind.RequestTurnOpened &&
      fault === RequestTurnFixture.WriteAdmission
    ) {
      const node = state.nodes.deliver;
      assert.ok(node);
      const evidence = node.evidence;
      node.evidence = ["x".repeat(BoardLimit.RecordBytes)];
      try {
        return original.call(this, state, kind, data);
      } finally {
        node.evidence = evidence;
      }
    }
    const result = original.call(this, state, kind, data);
    if (
      this.root === run.root &&
      kind === RunEventKind.RequestTurnOpened &&
      fault === RequestTurnFixture.LostAck
    )
      return result.then(() => {
        throw new Error("Lost request turn acknowledgement");
      });
    return result;
  };
  try {
    await engine.start(run.run_id);
  } finally {
    RunStore.prototype.commit = original;
  }
  if (invalid || count > allowance || fault === RequestTurnFixture.WriteAdmission) {
    assert.equal(run.state, RunStatus.Blocked);
    assert.equal((await engine.requests.list(run.run_id)).length, 0);
    assert.equal(run.nodes.deliver?.attempt, 1);
    assert.deepEqual(run.nodes.deliver?.evidence, []);
    assert.equal(run.nodes.deliver?.phases[selected]?.usage.length, 1);
    assert.equal(run.schema_version, RunFormat.CaptureReceipts);
    return true;
  }
  const expectedState =
    fault === RequestTurnFixture.LostAck ? RunStatus.Blocked : RunStatus.Waiting;
  assert.equal(
    run.state,
    expectedState,
    JSON.stringify(
      Object.values(run.nodes).flatMap((node) =>
        Object.values(node.phases).map((phase) => phase.error),
      ),
    ),
  );
  assert.equal(run.schema_version, RunFormat.CaptureReceipts);
  assert.equal(run.harness_session_id, callerSession);
  assert.equal(
    run.nodes.deliver?.state,
    fault === RequestTurnFixture.LostAck ? StepStatus.Blocked : StepStatus.Waiting,
  );
  assert.equal(run.nodes.peer?.state, StepStatus.Passed);
  assert.equal(run.nodes.dependent?.state, StepStatus.Pending);
  assert.equal(run.artifacts, null);
  const phase = run.nodes.deliver?.phases[selected];
  assert.ok(phase?.session_id);
  const session = phase.session_id;
  const requests = await engine.requests.list(run.run_id);
  assert.equal(requests.length, count);
  const request = requests[0];
  assert.ok(request);
  assert.equal(request.origin.execution?.phase, selected);
  assert.equal(request.origin.harness_session_id, session);
  if (callerSession !== undefined) assert.notEqual(session, callerSession);
  if ([RequestTurnFixture.ForgedOrigin, RequestTurnFixture.MissingMember].includes(fault)) {
    await forgeTurn(run, selected, fault);
    const restored = new Engine(factory);
    const error = await thrownBy(() => restored.load(run.root));
    assert.equal(restored.has(run.run_id), false);
    assert.ok(error);
    assert.equal(Reflect.get(Object(error), "code"), ErrorCode.CorruptBoard);
    return true;
  }
  const cursor = run.version;
  const retained = await engine.requests.openTurn(
    run.run_id,
    requests.map(({ request_id, kind, scope, origin, expires_at }) => ({
      request_id,
      kind,
      scope,
      origin,
      expires_at,
    })),
    engine.cancel.bind(engine, run.run_id),
  );
  assert.deepEqual(retained, requests);
  assert.equal(
    run.state,
    expectedState,
    JSON.stringify(
      Object.values(run.nodes).flatMap((node) =>
        Object.values(node.phases).map((phase) => phase.error),
      ),
    ),
  );
  assert.equal(run.version, cursor);
  const recovered = reload ? new Engine(factory) : engine;
  const restored = reload ? await recovered.load(run.root) : run;
  if (pending) {
    await recovered.resume(run.run_id);
    assert.equal(restored.state, RunStatus.Waiting);
    if (backendId === Backend.Fake) assert.equal(calls, 1);
    assert.equal(restored.nodes.deliver?.phases[selected]?.retries, 0);
  }
  const decision = reload ? RequestDecision.Deny : RequestDecision.Approve;
  for (const request of requests)
    await recovered.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision,
        reason: "Reviewed request turn",
      },
      { client_id: "reviewer", authority: ApprovalLevel.Main },
    );
  if (fault === RequestTurnFixture.ResumeAdmission) {
    const observer = await recovered.requests.open(run.run_id, {
      request_id: "admission-observer",
      kind: request.kind,
      scope: request.scope,
      origin: { client_id: "observer", harness_session_id: null },
      expires_at: request.expires_at,
    });
    holdAdmission = true;
    const continuing = recovered.resume(run.run_id);
    try {
      await admission.promise;
      const held = await recovered.snapshot(run.run_id);
      const usage = await recovered.usage(run.run_id);
      assert.equal(recovered.resume(run.run_id), continuing);
      assert.equal(recovered.resume(run.run_id), continuing);
      assert.equal(recovered.resume(run.run_id), continuing);
      assert.equal(restored.nodes.deliver?.state, StepStatus.Running);
      assert.deepEqual(await recovered.snapshot(run.run_id), held);
      assert.deepEqual(await recovered.usage(run.run_id), usage);
      await recovered.requests.answer(
        {
          run_id: run.run_id,
          request_id: observer.request_id,
          version: observer.version,
          decision: RequestDecision.Approve,
          reason: "Independent observer decision",
        },
        { client_id: "observer", authority: ApprovalLevel.Main },
      );
      const before = restored.version;
      const failure = await thrownBy(() =>
        recovered.requests.open(run.run_id, {
          request_id: "late-waiting-origin",
          kind: request.kind,
          scope: request.scope,
          origin: request.origin,
          expires_at: request.expires_at,
        }),
      );
      assert.ok(failure);
      assert.equal(Reflect.get(Object(failure), "code"), ErrorCode.PermissionDenied);
      assert.equal(restored.version, before);
    } finally {
      releaseAdmission.resolve();
      await continuing;
    }
  } else await recovered.resume(run.run_id);
  assert.equal(restored.state, RunStatus.Passed);
  const completed = restored.nodes.deliver?.phases[selected];
  assert.equal(completed?.session_id, session);
  assert.equal(completed?.executions, 2);
  assert.equal(completed?.retries, 0);
  assert.equal(restored.nodes.deliver?.attempt, 1);
  assert.deepEqual(restored.nodes.deliver?.evidence, []);
  if (backendId === Backend.Fake) assert.equal(calls, 2);
  else {
    const work = restored.nodes.deliver?.work;
    assert.ok(work);
    const cwd = checker ? resolve(work, "..", "review-0") : work;
    const directory = resolve(cwd, ".titan/vendor-fixture");
    const nativeCalls = (await readFile(resolve(directory, "calls.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => VendorStubCallSchema.parse(JSON.parse(line)));
    assert.deepEqual(
      nativeCalls.map((call) => call.resume),
      [false, true],
    );
    for (const call of nativeCalls)
      assert.equal(await waitUntil(() => processExited(call.pid)), true);
    delivered = JSON.parse(await readFile(resolve(directory, "request-answers.json"), "utf8"));
  }
  const finalRequests = await recovered.requests.list(run.run_id);
  assert.equal(
    finalRequests.length,
    count + (fault === RequestTurnFixture.ResumeAdmission ? 1 : 0),
  );
  assert.deepEqual(
    delivered,
    finalRequests
      .filter(
        (request) =>
          request.origin.execution?.step_id === "deliver" &&
          request.origin.execution.phase === selected,
      )
      .map((request) => ({
        request_id: request.request_id,
        kind: request.kind,
        answer: request.answer,
      })),
  );
  const events = await recovered.events(run.run_id);
  assert.equal(
    events.events.filter((event) => event.type === RunEventKind.RequestTurnOpened).length,
    1,
  );
  const final = new Engine(factory);
  const finalRun = await final.load(run.root);
  assert.equal(finalRun.harness_session_id, callerSession);
  assert.equal(finalRun.schema_version, RunFormat.CaptureReceipts);
  assert.equal((await final.requests.list(run.run_id))[0]?.answer?.decision, decision);
  const usage = await recovered.usage(run.run_id);
  assert.equal(usage.executions, 7);
  assert.equal(usage.reported_executions, 7);
  assert.equal(usage.unreported_executions, 0);
  assert.deepEqual(await final.usage(run.run_id), usage);
  return true;
}

async function forgeTurn(run: Run, selected: string, fault: RequestTurnFixture) {
  const path = resolve(run.root, BoardFile.Journal);
  const bytes = await readFileBytes(path, IoLimit.ResponseBytes);
  let changed = false;
  const lines = bytes
    .toString(FileEncoding.Utf8)
    .trimEnd()
    .split(Newline)
    .map((line) => {
      const event = RunEventSchema.parse(JSON.parse(line));
      if (event.type !== RunEventKind.RequestTurnOpened) return line;
      const batch = RequestTurnBatchSchema.parse(event.data);
      const entry = batch[0];
      assert.ok(entry?.origin.execution);
      if (fault === RequestTurnFixture.ForgedOrigin)
        entry.origin.execution.execution_id = "forged-turn";
      else {
        const phase = event.state.nodes.deliver?.phases[selected];
        assert.ok(phase?.request_turn);
        phase.request_turn.request_ids = ["missing-member"];
      }
      event.data = batch;
      changed = true;
      return JSON.stringify(event);
    });
  assert.ok(changed);
  await atomicWrite(path, Buffer.from(lines.join(Newline) + Newline));
}

function requestTurnDescriptions(count: number) {
  return Array.from({ length: count }, () => {
    const scope = {
      operation: "read",
      resource: "reference",
      content_hashes: {},
      arguments: [],
      environment_names: [],
    };
    return { kind: RequestKind.Resource, scope, expires_at: Date.now() + 60000 };
  });
}
