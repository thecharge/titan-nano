import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  ErrorCode,
  RequestDecision,
  RequestFixture,
  RequestKind,
  RequestLimit,
  RunEventKind,
  TaskOutcome,
} from "@titan/constants";
import { hash, settle } from "@titan/core";
import { RequestLedger } from "@titan/requests";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { OperationRequestSchema, type RequestJournalPort } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";

function requestResource(): string {
  return "candidate-a";
}

export async function operationRequests(
  mode: RequestFixture,
  kind: RequestKind = RequestKind.Action,
  expectedLevel: ApprovalLevel = ApprovalLevel.Human,
) {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(() => createFakeBackend());
    const config = await resolveConfig({ home: resolve(project, "home"), project });
    const create = async (submission: string) => {
      const run = await engine.create({
        project,
        plan: validateWorkflow(vendorRecoveryWorkflow()),
        config,
        backend: Backend.Fake,
        client_id: "request-owner",
        submission_id: submission,
      });
      const store = new RunStore(run.root);
      await store.read();
      return { run, store };
    };
    const first = await create("first");
    const second = await create("second");
    const now = 1000;
    let clock = now;
    let failAppend = false;
    let lostOpen = mode === RequestFixture.LostOpen;
    const port: RequestJournalPort = {
      snapshot: async (id) => {
        const selected = id === first.run.run_id ? first : second;
        if (mode === RequestFixture.ForeignSnapshot) return second.store.snapshot();
        return selected.store.snapshot();
      },
      events: (id, through) => (id === first.run.run_id ? first : second).store.events(through),
      append: async (id, kind, request) => {
        if (failAppend) throw new Error("append refused");
        const selected = id === first.run.run_id ? first : second;
        await selected.store.commit(selected.run, kind, request);
        if (lostOpen) {
          lostOpen = false;
          throw new Error("response lost after durable append");
        }
      },
    };
    let ledger = new RequestLedger(
      port,
      { max_requests: mode === RequestFixture.Capacity ? 1 : 4 },
      () => clock,
    );
    const scope = {
      operation: "run-check",
      resource: requestResource(),
      content_hashes: { command: hash("bun test"), candidate: hash("source") },
      arguments: ["bun", "test"],
      environment_names: ["CI"],
    };
    const input = {
      request_id: "operation-request",
      kind,
      scope,
      origin: { client_id: "first-client", harness_session_id: "first-harness" },
      expires_at: 2000,
    };
    if (mode === RequestFixture.AccessorInput)
      Object.defineProperty(input.scope, "resource", { get: requestResource, enumerable: true });
    if (mode === RequestFixture.OversizedInput)
      scope.resource = "x".repeat(RequestLimit.InputBytes);
    if (mode === RequestFixture.InvalidKind) Reflect.set(input, "kind", "unknown");
    if (mode === RequestFixture.ExpiredOpen) input.expires_at = now;
    if (mode === RequestFixture.InvalidLimit) return new RequestLedger(port, { max_requests: 257 });
    const opening = () => ledger.open(first.run.run_id, input);
    if (mode === RequestFixture.FailedAppend) {
      failAppend = true;
      assert.ok(await thrownBy(opening));
      assert.equal((await ledger.list(first.run.run_id)).length, 0);
      failAppend = false;
    }
    if (mode === RequestFixture.Queue) {
      const entered = Promise.withResolvers<void>();
      const gate = Promise.withResolvers<void>();
      const snapshot = port.snapshot;
      port.snapshot = async (id) => {
        entered.resolve();
        await gate.promise;
        return snapshot(id);
      };
      ledger = new RequestLedger(port, { max_pending_operations: 1 }, () => clock);
      const pending = opening();
      await entered.promise;
      const rejection = thrownBy(opening);
      gate.resolve();
      await pending;
      const failure = await rejection;
      assert.equal((await ledger.list(first.run.run_id)).length, 1);
      throw failure;
    }
    if (mode === RequestFixture.LostOpen) {
      assert.ok(await thrownBy(opening));
      assert.equal((await ledger.list(first.run.run_id)).length, 1);
    }
    const request = await opening();
    assert.equal(request.level, expectedLevel);
    assert.equal(request.version, 1);
    assert.equal((await ledger.list(first.run.run_id)).length, 1);
    assert.equal((await ledger.list(second.run.run_id)).length, 0);
    if (mode === RequestFixture.IdempotentOpen) {
      assert.deepEqual(await opening(), request);
      assert.equal((await ledger.list(first.run.run_id)).length, 1);
    }
    if (mode === RequestFixture.ChangedOpen || mode === RequestFixture.ChangedOrigin) {
      const changed = {
        ...input,
        ...(mode === RequestFixture.ChangedOpen
          ? { scope: { ...scope, resource: "changed" } }
          : { origin: { ...input.origin, client_id: "other-client" } }),
      };
      const failure = await thrownBy(async () => ledger.open(first.run.run_id, changed));
      assert.deepEqual((await ledger.list(first.run.run_id))[0], request);
      throw failure;
    }
    const actor = { client_id: "person", authority: request.level };
    const answer = {
      run_id: first.run.run_id,
      request_id: request.request_id,
      version: request.version,
      decision: RequestDecision.Approve,
      reason: "Reviewed exact operation",
    };
    if (mode === RequestFixture.WrongRun) answer.run_id = second.run.run_id;
    if (mode === RequestFixture.WrongVersion) answer.version++;
    if (mode === RequestFixture.AgentAnswer) actor.authority = ApprovalLevel.Main;
    if (mode === RequestFixture.InvalidActor) Reflect.set(actor, "authority", "unknown");
    if (mode === RequestFixture.InvalidAnswer) answer.reason = "";
    if (mode === RequestFixture.Expired) clock = input.expires_at;
    if (mode === RequestFixture.BackwardsClock) clock = now - 1;
    if (mode === RequestFixture.Deny || mode === RequestFixture.DeniedApproval)
      answer.decision = RequestDecision.Deny;
    const answering = () => ledger.answer(answer, actor);
    const decidedRecord = {
      ...request,
      version: 2,
      answer: { decision: answer.decision, reason: answer.reason, actor, decided_at: clock },
    };
    let corrupted: unknown;
    let corruptKind = RunEventKind.RequestOpened;
    if (mode === RequestFixture.DuplicateOpen) corrupted = request;
    if (mode === RequestFixture.InvalidRecord) corrupted = { unknown: true };
    if (mode === RequestFixture.OversizedRecord)
      corrupted = {
        ...request,
        scope: { ...scope, resource: "x".repeat(RequestLimit.InputBytes) },
      };
    if (mode === RequestFixture.ForeignRecord)
      corrupted = { ...request, run_id: second.run.run_id };
    if (mode === RequestFixture.ReplayLevel)
      corrupted = { ...request, request_id: "lower-level", level: ApprovalLevel.Main };
    if (mode === RequestFixture.AnswerWithoutOpen) {
      corrupted = { ...decidedRecord, request_id: "absent" };
      corruptKind = RunEventKind.RequestAnswered;
    }
    if (mode === RequestFixture.ReplayScope) {
      corrupted = { ...decidedRecord, scope: { ...scope, resource: "changed" } };
      corruptKind = RunEventKind.RequestAnswered;
    }
    if (mode === RequestFixture.ReplayAuthority) {
      corrupted = {
        ...decidedRecord,
        answer: { ...decidedRecord.answer, actor: { ...actor, authority: ApprovalLevel.Main } },
      };
      corruptKind = RunEventKind.RequestAnswered;
    }
    if (mode === RequestFixture.ReplayTime) {
      corrupted = {
        ...decidedRecord,
        answer: { ...decidedRecord.answer, decided_at: input.expires_at },
      };
      corruptKind = RunEventKind.RequestAnswered;
    }
    if (mode === RequestFixture.OpeningAnswered)
      corrupted = { ...decidedRecord, request_id: "answered-open" };
    if (corrupted !== undefined) {
      await first.store.commit(first.run, corruptKind, corrupted);
      return ledger.list(first.run.run_id);
    }
    if (mode === RequestFixture.ReplayCapacity) {
      await first.store.commit(first.run, RunEventKind.RequestOpened, {
        ...request,
        request_id: "second",
      });
      return new RequestLedger(port, { max_requests: 1 }).list(first.run.run_id);
    }
    if (mode === RequestFixture.FailedAnswer) {
      failAppend = true;
      assert.ok(await thrownBy(answering));
      assert.equal((await ledger.list(first.run.run_id))[0]?.answer, null);
      failAppend = false;
    }
    if (mode === RequestFixture.Concurrent) {
      const outcomes = await settle([answering, answering], 2);
      assert.equal(outcomes.filter((item) => item.status === TaskOutcome.Fulfilled).length, 1);
      const rejected = outcomes.find((item) => item.status === TaskOutcome.Rejected);
      assert.ok(rejected && rejected.status === TaskOutcome.Rejected);
      assert.equal(Reflect.get(rejected.reason, "code"), ErrorCode.RequestConflict);
    } else {
      const error = await thrownBy(async () => {
        await answering();
      });
      if (error) {
        assert.equal((await ledger.list(first.run.run_id))[0]?.answer, null);
        assert.equal((await ledger.list(second.run.run_id)).length, 0);
        throw error;
      }
    }
    const decided = (await ledger.list(first.run.run_id))[0];
    assert.ok(decided?.answer);
    assert.equal(decided.version, 2);
    assert.equal(decided.answer.actor.client_id, actor.client_id);
    if (mode === RequestFixture.SecondAnswer)
      return ledger.answer({ ...answer, version: 2 }, actor);
    if (mode === RequestFixture.Capacity)
      return ledger.open(first.run.run_id, { ...input, request_id: "new-request" });
    if (mode === RequestFixture.IdempotentOpen) assert.deepEqual(await opening(), decided);
    if (mode === RequestFixture.ChangedDecision) {
      await first.store.commit(first.run, RunEventKind.RequestAnswered, decided);
      return ledger.list(first.run.run_id);
    }
    if (mode === RequestFixture.Reload) {
      first.store = new RunStore(first.run.root);
      first.run = await first.store.read();
      ledger = new RequestLedger(port, {}, () => clock);
      assert.deepEqual((await ledger.list(first.run.run_id))[0], decided);
    }
    if (mode === RequestFixture.Deny) return true;
    if (mode === RequestFixture.ChangedCommand) scope.operation = "other-command";
    if (mode === RequestFixture.ChangedArguments) scope.arguments.push("--update");
    if (mode === RequestFixture.ChangedHash) scope.content_hashes.candidate = hash("changed");
    if (mode === RequestFixture.ChangedEnvironment) scope.environment_names.push("TOKEN");
    if (mode === RequestFixture.ChangedResource) scope.resource = "other-candidate";
    if (mode === RequestFixture.ExpiredApproval) clock = input.expires_at;
    if (mode === RequestFixture.FutureApproval) clock = now - 1;
    if (mode === RequestFixture.InvalidScope) scope.resource = "";
    if (mode === RequestFixture.AccessorScope)
      Object.defineProperty(scope, "resource", { get: requestResource, enumerable: true });
    if (mode === RequestFixture.CrossRunId) await ledger.open(second.run.run_id, input);
    const runId =
      mode === RequestFixture.OtherRunApproval || mode === RequestFixture.CrossRunId
        ? second.run.run_id
        : first.run.run_id;
    const requestId = mode === RequestFixture.MissingApproval ? "missing" : request.request_id;
    assert.equal(
      (
        await ledger.approved(
          runId,
          requestId,
          mode === RequestFixture.WrongKind ? RequestKind.ToolServer : input.kind,
          scope,
        )
      ).request_id,
      request.request_id,
    );
    const events = [];
    for await (const event of first.store.events())
      if (event.type === RunEventKind.RequestAnswered) events.push(event);
    assert.equal(events.length, 1);
    assert.deepEqual(OperationRequestSchema.parse(events[0]?.data), decided);
    return true;
  });
}

export async function engineRequests(mode: RequestFixture) {
  return withTemporaryDirectory(async (project) => {
    const factory = () => createFakeBackend();
    const engine = new Engine(factory);
    assert.equal(engine.requests, engine.requests);
    if (mode === RequestFixture.MissingApproval) return engine.requests.list("missing");
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "engine-client",
      submission_id: "engine-request",
    });
    const request = await engine.requests.open(run.run_id, {
      request_id: "engine-request",
      kind: RequestKind.Action,
      scope: {
        operation: "check",
        resource: "candidate",
        content_hashes: { candidate: hash("candidate") },
        arguments: ["bun", "test"],
        environment_names: [],
      },
      origin: { client_id: run.client_id, harness_session_id: "engine-harness" },
      expires_at: Date.now() + 60_000,
    });
    const restored = new Engine(factory);
    await restored.load(run.root);
    const denial = mode === RequestFixture.Deny;
    const decided = await restored.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: mode === RequestFixture.WrongVersion ? 2 : 1,
        decision: denial ? RequestDecision.Deny : RequestDecision.Approve,
        reason: "Reviewed",
      },
      {
        client_id: "engine-person",
        authority: mode === RequestFixture.AgentAnswer ? ApprovalLevel.Main : ApprovalLevel.Human,
      },
    );
    assert.equal(
      (await restored.requests.list(run.run_id))[0]?.answer?.decision,
      decided.answer?.decision,
    );
    if (!denial)
      await restored.requests.approved(
        run.run_id,
        request.request_id,
        RequestKind.Action,
        request.scope,
      );
    return true;
  });
}
