import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  ErrorCode,
  ExecutionPhase,
  RequestDecision,
  RequestKind,
  RequestLimit,
  RequestTurnAdmissionFixture,
  RunStatus,
  TaskOutcome,
  Verdict,
} from "@titan/constants";
import { settle } from "@titan/core";
import { Engine } from "@titan/runner";
import { jsonByteLength } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type OperationRequestInput, OperationRequestInputSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";
import { executionRequest } from "./request-execution.ts";

function fill(input: OperationRequestInput, target: number): void {
  input.scope.arguments = [];
  while (
    target - jsonByteLength(input, RequestLimit.InputBytes) >
    RequestLimit.TextCharacters * 6 + 3
  )
    input.scope.arguments.push("\0".repeat(RequestLimit.TextCharacters));
  input.scope.arguments.push("");
  const remaining = target - jsonByteLength(input, RequestLimit.InputBytes);
  assert.ok(remaining >= 0);
  input.scope.arguments[input.scope.arguments.length - 1] =
    "\0".repeat(Math.floor(remaining / 6)) + "x".repeat(remaining % 6);
  assert.equal(jsonByteLength(input, RequestLimit.InputBytes), target);
  OperationRequestInputSchema.parse(input);
}

async function recordBudget(project: string, padding: number, reasonCharacters: number) {
  const factory = () => createFakeBackend();
  const engine = new Engine(factory);
  const config = await resolveConfig({ home: resolve(project, "home"), project });
  const run = await engine.create({
    project,
    config,
    plan: validateWorkflow(checkedWorkflow()),
    backend: Backend.Fake,
    client_id: "budget",
    submission_id: "first",
  });
  await engine.start(run.run_id);
  const scope = {
    operation: "read",
    resource: "candidate",
    content_hashes: {},
    arguments: [],
    environment_names: [],
  };
  const input: OperationRequestInput = {
    request_id: "budget-request",
    kind: RequestKind.Tool,
    scope,
    origin: { client_id: "origin", harness_session_id: "harness" },
    expires_at: Date.now() + 60000,
  };
  fill(input, RequestLimit.InputBytes - padding);
  const before = (await engine.snapshot(run.run_id)).version;
  let opened = false;
  try {
    const request = await engine.requests.open(run.run_id, input);
    opened = true;
    const decided = await engine.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: RequestDecision.Approve,
        reason: "x".repeat(reasonCharacters),
      },
      { client_id: "reviewer", authority: ApprovalLevel.Main },
    );
    const recovered = new Engine(factory);
    await recovered.load(run.root);
    assert.deepEqual(await recovered.requests.list(run.run_id), [decided]);
    return true;
  } catch (error) {
    assert.equal(Reflect.get(Object(error), "code"), ErrorCode.InvalidRequest);
    assert.equal((await engine.snapshot(run.run_id)).version, before + (opened ? 1 : 0));
    const requests = await engine.requests.list(run.run_id);
    assert.equal(requests.length, opened ? 1 : 0);
    assert.equal(requests[0]?.answer ?? null, null);
    if (opened)
      await engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: input.request_id,
          version: 1,
          decision: RequestDecision.Deny,
          reason: "No",
        },
        { client_id: "reviewer", authority: ApprovalLevel.Main },
      );
    else
      await engine.requests.open(run.run_id, {
        ...input,
        scope: { ...input.scope, arguments: [] },
      });
    throw error;
  }
}

export async function requestRecordBudget(padding: number, reasonCharacters: number) {
  return withTemporaryDirectory((project) => recordBudget(project, padding, reasonCharacters));
}

async function turnRecordAdmission(
  project: string,
  padding: number,
  checker: boolean,
  fault: RequestTurnAdmissionFixture,
) {
  let entered = false;
  const release = Promise.withResolvers<void>();
  const selected = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
  const backend = new FakeBackend(async (spec) => {
    if (spec.invocation_id.endsWith(`/${selected}`)) {
      entered = true;
      await release.promise;
    }
    return {
      json: spec.writable
        ? { ok: true, marker: "candidate", turn: 1 }
        : { verdict: Verdict.Survived, evidence: "Checked candidate" },
    };
  });
  const engine = new Engine(() => backend);
  const config = await resolveConfig({ home: resolve(project, "home"), project });
  const run = await engine.create({
    project,
    config,
    plan: validateWorkflow(vendorRecoveryWorkflow()),
    backend: Backend.Fake,
    client_id: "turn-admission",
    submission_id: "first",
  });
  const running = settle([() => engine.start(run.run_id)]);
  let publications = 0;
  let cursor = run.version;
  try {
    assert.ok(await waitUntil(async () => entered));
    const before = await engine.snapshot(run.run_id);
    cursor = before.version;
    const input = executionRequest(before, "deliver", selected);
    assert.ok(input.origin.execution);
    if (fault === RequestTurnAdmissionFixture.Execution)
      input.origin.execution.execution_id = "other-execution";
    if (fault === RequestTurnAdmissionFixture.Session)
      input.origin.harness_session_id = "other-session";
    if (fault === RequestTurnAdmissionFixture.Expired) input.expires_at = Date.now() - 1;
    fill(input, RequestLimit.InputBytes - padding);
    const records = await engine.requests.openTurn(run.run_id, [input], async (batch) => {
      publications++;
      assert.equal(batch.length, 1);
      assert.deepEqual(batch[0]?.origin, input.origin);
      assert.ok(jsonByteLength(batch[0], RequestLimit.InputBytes) <= RequestLimit.InputBytes);
    });
    assert.equal(records.length, 1);
    assert.equal(publications, 1);
    assert.deepEqual(await engine.snapshot(run.run_id), before);
    return true;
  } catch (error) {
    assert.equal(publications, 0);
    assert.equal((await engine.snapshot(run.run_id)).version, cursor);
    assert.equal((await engine.requests.list(run.run_id)).length, 0);
    throw error;
  } finally {
    release.resolve();
    const completed = await running;
    assert.equal(completed[0]?.status, TaskOutcome.Fulfilled);
    assert.equal(run.state, RunStatus.Passed);
  }
}

export async function requestTurnRecordAdmission(
  padding: number,
  checker: boolean,
  fault: RequestTurnAdmissionFixture = RequestTurnAdmissionFixture.Valid,
) {
  return withTemporaryDirectory((project) => turnRecordAdmission(project, padding, checker, fault));
}
