import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  ErrorCode,
  RequestDecision,
  RequestEscalationFixture,
  RequestKind,
  RequestLimit,
  RequestVersion,
  RunEventKind,
  TaskOutcome,
} from "@titan/constants";
import { hash, settle } from "@titan/core";
import { RequestLedger } from "@titan/requests";
import { Engine } from "@titan/runner";
import { jsonByteLength } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type {
  OperationRequest,
  OperationScope,
  RequestActor,
  RequestJournalPort,
  Run,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";

export async function requestEscalation(mode: RequestEscalationFixture) {
  return withTemporaryDirectory(async (project) => {
    const config = await resolveConfig({ home: resolve(project, "home"), project });
    const engine = new Engine(createFakeBackend);
    const runs: Run[] = [];
    for (const submission of ["one", "two"])
      runs.push(
        await engine.create({
          project,
          config,
          plan: validateWorkflow(vendorRecoveryWorkflow()),
          backend: Backend.Fake,
          client_id: "owner",
          submission_id: submission,
        }),
      );
    const first = runs[0];
    const second = runs[1];
    assert.ok(first);
    assert.ok(second);
    const stores = new Map<string, RunStore>();
    for (const run of runs) {
      const store = new RunStore(run.root);
      await store.read();
      stores.set(run.run_id, store);
    }
    const selectedStore = (id: string) => {
      const store = stores.get(id);
      assert.ok(store);
      return store;
    };
    let clock = 1000;
    let failed = mode === RequestEscalationFixture.Failed;
    let lost = mode === RequestEscalationFixture.Lost;
    let reads = 0;
    const reason = () => {
      reads++;
      return "Reviewed exact request";
    };
    const port: RequestJournalPort = {
      snapshot: async (id) => selectedStore(id).snapshot(),
      events: (id, through) => selectedStore(id).events(through),
      append: async (id, kind, request) => {
        if (kind === RunEventKind.RequestEscalated && failed) throw new Error("append refused");
        const run = runs.find((item) => item.run_id === id);
        assert.ok(run);
        await selectedStore(id).commit(run, kind, request);
        if (kind === RunEventKind.RequestEscalated && lost) {
          lost = false;
          throw new Error("response lost after commit");
        }
      },
    };
    let ledger = new RequestLedger(port, {}, () => clock);
    const scope: OperationScope = {
      operation: "inspect",
      resource: "candidate",
      content_hashes: { candidate: hash("source") },
      arguments: [],
      environment_names: [],
    };
    if (
      [RequestEscalationFixture.RecordBytes, RequestEscalationFixture.RecordAnswerBytes].includes(
        mode,
      )
    )
      scope.arguments = Array.from({ length: 30 }, () => "\0".repeat(2800));
    const opening = await ledger.open(first.run_id, {
      request_id: "permission",
      kind:
        mode === RequestEscalationFixture.Human
          ? RequestKind.Action
          : mode === RequestEscalationFixture.Auto
            ? RequestKind.Ask
            : RequestKind.Tool,
      scope,
      origin: { client_id: "codex", harness_session_id: "session-a" },
      expires_at: 2000,
    });
    assert.ok(jsonByteLength(opening, RequestLimit.InputBytes) <= RequestLimit.InputBytes);
    const input = {
      run_id: first.run_id,
      request_id: opening.request_id,
      version: opening.version,
      reason: reason(),
    };
    const main: RequestActor = { client_id: "main-reviewer", authority: ApprovalLevel.Main };
    const person: RequestActor = { client_id: "person-reviewer", authority: ApprovalLevel.Human };
    const escalate = () => ledger.escalate(input, main);
    const answer = () => ledger.answer({ ...input, decision: RequestDecision.Approve }, main);
    if (mode === RequestEscalationFixture.Stale) input.version = RequestVersion.Escalated;
    if (mode === RequestEscalationFixture.Missing) input.request_id = "missing";
    if (mode === RequestEscalationFixture.WrongRun) input.run_id = second.run_id;
    if (mode === RequestEscalationFixture.AutoActor) main.authority = ApprovalLevel.Auto;
    if (mode === RequestEscalationFixture.Invalid) input.reason = "";
    if (mode === RequestEscalationFixture.Accessor)
      Object.defineProperty(input, "reason", { enumerable: true, get: reason });
    if (mode === RequestEscalationFixture.InputBytes)
      input.reason = "x".repeat(RequestLimit.InputBytes + 1);
    if (mode === RequestEscalationFixture.RecordBytes)
      input.reason = "\0".repeat(RequestLimit.TextCharacters);
    if (mode === RequestEscalationFixture.Expired) clock = 2000;
    if (mode === RequestEscalationFixture.Clock) clock = 999;
    if (mode === RequestEscalationFixture.Repeated) await escalate();
    if (mode === RequestEscalationFixture.Answered) await answer();
    const before = await selectedStore(first.run_id).snapshot();
    const unchanged = await ledger.list(first.run_id);
    try {
      if (
        [
          RequestEscalationFixture.ConcurrentEscalate,
          RequestEscalationFixture.ConcurrentAnswer,
        ].includes(mode)
      ) {
        const outcomes = await settle(
          mode === RequestEscalationFixture.ConcurrentEscalate
            ? [escalate, answer]
            : [answer, escalate],
        );
        assert.equal(outcomes.filter((item) => item.status === TaskOutcome.Fulfilled).length, 1);
        assert.equal(outcomes.filter((item) => item.status === TaskOutcome.Rejected).length, 1);
        const kept = (await ledger.list(first.run_id))[0];
        assert.ok(kept);
        assert.equal(
          kept.level,
          mode === RequestEscalationFixture.ConcurrentEscalate
            ? ApprovalLevel.Human
            : ApprovalLevel.Main,
        );
        if (kept.answer === null)
          await ledger.answer(
            { ...input, version: kept.version, decision: RequestDecision.Approve },
            person,
          );
        return true;
      }
      if (mode === RequestEscalationFixture.Failed) {
        assert.ok(await thrownBy(escalate));
        assert.deepEqual(await ledger.list(first.run_id), unchanged);
        assert.equal((await selectedStore(first.run_id).snapshot()).version, before.version);
        failed = false;
      }
      const corrupt = [
        RequestEscalationFixture.ChangedScope,
        RequestEscalationFixture.ChangedOrigin,
        RequestEscalationFixture.ChangedCreated,
        RequestEscalationFixture.MissingAudit,
        RequestEscalationFixture.AutoAudit,
        RequestEscalationFixture.Opening,
      ].includes(mode);
      if (corrupt) {
        const forged: OperationRequest = {
          ...opening,
          version: RequestVersion.Escalated,
          level: ApprovalLevel.Human,
          escalation: { reason: "Passed up", actor: main, escalated_at: 1000 },
        };
        if (mode === RequestEscalationFixture.ChangedScope)
          forged.scope = { ...scope, resource: "other" };
        if (mode === RequestEscalationFixture.ChangedOrigin)
          forged.origin = { ...opening.origin, client_id: "other" };
        if (mode === RequestEscalationFixture.ChangedCreated) forged.created_at = 999;
        if (mode === RequestEscalationFixture.MissingAudit) delete forged.escalation;
        if (mode === RequestEscalationFixture.AutoAudit) {
          assert.ok(forged.escalation);
          forged.escalation.actor = { ...main, authority: ApprovalLevel.Auto };
        }
        if (mode === RequestEscalationFixture.Opening) forged.request_id = "forged-opening";
        await selectedStore(first.run_id).commit(
          first,
          mode === RequestEscalationFixture.Opening
            ? RunEventKind.RequestOpened
            : RunEventKind.RequestEscalated,
          forged,
        );
        await new RequestLedger(port).list(first.run_id);
        return true;
      }
      if (
        [RequestEscalationFixture.AnswerTime, RequestEscalationFixture.ClockAnswer].includes(mode)
      )
        clock = 1400;
      let escalated: OperationRequest;
      if (mode === RequestEscalationFixture.Lost) {
        assert.ok(await thrownBy(escalate));
        const kept = (await ledger.list(first.run_id))[0];
        assert.ok(kept);
        escalated = kept;
      } else escalated = await escalate();
      assert.equal(escalated.version, RequestVersion.Escalated);
      assert.equal(escalated.level, ApprovalLevel.Human);
      assert.equal(escalated.answer, null);
      assert.deepEqual(escalated.scope, opening.scope);
      assert.deepEqual(escalated.origin, opening.origin);
      assert.deepEqual(escalated.escalation, {
        reason: input.reason,
        actor: main,
        escalated_at: clock,
      });
      if (mode === RequestEscalationFixture.Duplicate) {
        await selectedStore(first.run_id).commit(first, RunEventKind.RequestEscalated, escalated);
        await new RequestLedger(port).list(first.run_id);
        return true;
      }
      if (
        [RequestEscalationFixture.ChangedAudit, RequestEscalationFixture.AnswerTime].includes(mode)
      ) {
        assert.ok(escalated.escalation);
        const forged: OperationRequest = {
          ...escalated,
          version: RequestVersion.EscalatedAnswered,
          escalation: {
            ...escalated.escalation,
            reason:
              mode === RequestEscalationFixture.ChangedAudit
                ? "Changed reason"
                : escalated.escalation.reason,
          },
          answer: {
            decision: RequestDecision.Approve,
            reason: "Reviewed",
            actor: person,
            decided_at: mode === RequestEscalationFixture.AnswerTime ? 1200 : 1500,
          },
        };
        await selectedStore(first.run_id).commit(first, RunEventKind.RequestAnswered, forged);
        await new RequestLedger(port).list(first.run_id);
        return true;
      }
      for (const run of runs) {
        const store = new RunStore(run.root);
        await store.read();
        stores.set(run.run_id, store);
      }
      ledger = new RequestLedger(port, {}, () => clock);
      assert.deepEqual(await ledger.list(first.run_id), [escalated]);
      assert.deepEqual(await ledger.list(second.run_id), []);
      const retry = await thrownBy(escalate);
      assert.equal(Reflect.get(Object(retry), "code"), ErrorCode.RequestConflict);
      const attempt = {
        ...input,
        version: escalated.version,
        decision:
          mode === RequestEscalationFixture.Deny ? RequestDecision.Deny : RequestDecision.Approve,
      };
      const refused = await thrownBy(() => ledger.answer(attempt, main));
      assert.equal(Reflect.get(Object(refused), "code"), ErrorCode.PermissionDenied);
      assert.deepEqual(await ledger.list(first.run_id), [escalated]);
      if (mode === RequestEscalationFixture.Reload) return true;
      if (
        [RequestEscalationFixture.ClockAnswer, RequestEscalationFixture.RecordAnswerBytes].includes(
          mode,
        )
      ) {
        if (mode === RequestEscalationFixture.ClockAnswer) clock = 1200;
        else attempt.reason = "\0".repeat(RequestLimit.TextCharacters);
        const cursor = (await selectedStore(first.run_id).snapshot()).version;
        const failure = await thrownBy(() => ledger.answer(attempt, person));
        assert.equal((await selectedStore(first.run_id).snapshot()).version, cursor);
        assert.deepEqual(await ledger.list(first.run_id), [escalated]);
        throw failure;
      }
      const answered = await ledger.answer(attempt, person);
      assert.equal(answered.version, RequestVersion.EscalatedAnswered);
      assert.deepEqual(answered.escalation, escalated.escalation);
      assert.deepEqual(await new RequestLedger(port).list(first.run_id), [answered]);
      if (mode === RequestEscalationFixture.Deny) {
        const refused = await thrownBy(() =>
          ledger.approved(first.run_id, input.request_id, RequestKind.Tool, scope),
        );
        assert.equal(Reflect.get(Object(refused), "code"), ErrorCode.PermissionDenied);
      } else
        assert.deepEqual(
          await ledger.approved(first.run_id, input.request_id, RequestKind.Tool, scope),
          answered,
        );
      let passedUp = 0;
      for await (const event of selectedStore(first.run_id).events())
        if (event.type === RunEventKind.RequestEscalated) passedUp++;
      assert.equal(passedUp, 1);
      return true;
    } catch (error) {
      if (
        [
          RequestEscalationFixture.Human,
          RequestEscalationFixture.Auto,
          RequestEscalationFixture.Stale,
          RequestEscalationFixture.Repeated,
          RequestEscalationFixture.Answered,
          RequestEscalationFixture.Expired,
          RequestEscalationFixture.Clock,
          RequestEscalationFixture.Missing,
          RequestEscalationFixture.WrongRun,
          RequestEscalationFixture.AutoActor,
          RequestEscalationFixture.Invalid,
          RequestEscalationFixture.Accessor,
          RequestEscalationFixture.InputBytes,
          RequestEscalationFixture.RecordBytes,
        ].includes(mode)
      ) {
        assert.equal((await selectedStore(first.run_id).snapshot()).version, before.version);
        assert.deepEqual(await ledger.list(first.run_id), unchanged);
        assert.deepEqual(await ledger.list(second.run_id), []);
      }
      throw error;
    } finally {
      assert.equal(reads, 1);
    }
  });
}
