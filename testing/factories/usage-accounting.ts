import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  ExecutionPhase,
  RunEventKind,
  RunStatus,
  UsageHistoryFault,
  Verdict,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { Engine, UsageHistory } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { BackendId, RunEvent } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { schemaFakeAnswer } from "../support/backend.ts";

export async function incrementalUsage(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(
      () =>
        new FakeBackend(async (spec) => ({
          ...schemaFakeAnswer(spec),
          usage: { input_tokens: 11, output_tokens: 7, cost_usd: 0.03 },
        })),
    );
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      backend: Backend.Fake,
      client_id: "incremental-usage",
      submission_id: "one",
    });
    await engine.start(run.run_id);
    const events = new RunStore(run.root).events(run.version);
    const first = await events.next();
    assert.ok(!first.done);
    const history = new UsageHistory({ ...run, version: first.value.id });
    history.observe(first.value);
    if (mode === "gap" || mode === "repeat") {
      assert.throws(
        () => history.advance({ ...first.value, id: first.value.id + (mode === "gap" ? 2 : 0) }),
        { code: ErrorCode.CorruptBoard },
      );
      return true;
    }
    for await (const event of events) {
      history.advance(event);
      if (mode === "finish-each") history.finish();
    }
    assert.deepEqual(history.finish(), await engine.usage(run.run_id));
    return true;
  });
}

function mutateUsageEvent(event: RunEvent, fault: UsageHistoryFault) {
  const node = event.state.nodes.deliver;
  const phase = node?.phases[ExecutionPhase.Worker];
  assert.ok(node && phase);
  const usage = phase.usage[0];
  assert.ok(usage);
  if (fault === UsageHistoryFault.ChangedUsage) usage.input_tokens = 12;
  if (fault === UsageHistoryFault.LessUsage) phase.usage = [];
  if (fault === UsageHistoryFault.LessExecutions) phase.executions = 0;
  if (fault === UsageHistoryFault.MoreUsage) phase.usage.push(structuredClone(usage));
  if (fault === UsageHistoryFault.RewindAttempt) node.attempt--;
  if (fault === UsageHistoryFault.UnknownPhase) node.phases.foreign = phase;
  if (fault === UsageHistoryFault.WrongRun) event.state.run_id = "another-run";
  if (fault === UsageHistoryFault.FutureCursor) event.id++;
}

export async function usageAccounting(
  reload: boolean,
  interrupted = false,
  missingCost = false,
  cost = 0.03,
  fault = UsageHistoryFault.None,
  backendId: BackendId = Backend.Fake,
) {
  return withTemporaryDirectory(async (project) => {
    let failed = false;
    const backend = new FakeBackend(async (spec) => {
      if (
        interrupted &&
        !failed &&
        spec.invocation_id === `deliver/3/${ExecutionPhase.FalsifierPrefix}0`
      ) {
        failed = true;
        throw new OperationalError(ErrorCode.ExecutionInterrupted, "Usage report interrupted");
      }
      return {
        json: spec.writable
          ? { ok: true, marker: "candidate", turn: 1 }
          : {
              verdict: spec.invocation_id.includes("/3/") ? Verdict.Survived : Verdict.Refuted,
              evidence: spec.invocation_id,
            },
        usage: { input_tokens: 11, output_tokens: 7, cost_usd: missingCost ? null : cost },
      };
    });
    const factory = () => backend;
    const engine = new Engine(factory);
    const run = await engine.create({
      project,
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: { defaults: { max_attempts: 3 }, recovery: { max_retries: 1 } },
      }),
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      backend: backendId,
      client_id: "usage-accounting",
      submission_id: "usage-accounting",
    });
    await engine.start(run.run_id);
    if (interrupted) assert.equal(run.state, RunStatus.Blocked);
    const owner = reload ? new Engine(factory) : engine;
    if (reload) await owner.load(run.root);
    if (interrupted) await owner.resume(run.run_id);
    assert.equal(owner.get(run.run_id).state, RunStatus.Passed);
    const original = RunStore.prototype.events;
    RunStore.prototype.events = async function* (through) {
      for await (const event of original.call(this, through)) {
        if (this.root === run.root && event.type === RunEventKind.Passed)
          mutateUsageEvent(event, fault);
        yield event;
      }
    };
    try {
      const report = await owner.usage(run.run_id);
      assert.equal(report.executions, interrupted ? 7 : 6);
      assert.equal(report.reported_executions, 6);
      assert.equal(report.unreported_executions, interrupted ? 1 : 0);
      assert.deepEqual(report.known, {
        input_tokens: 66,
        output_tokens: 42,
        cost_usd: missingCost ? 0 : 0.18,
      });
      assert.deepEqual(report.complete, {
        input_tokens: !interrupted,
        output_tokens: !interrupted,
        cost_usd: !interrupted && !missingCost,
      });
      assert.equal(report.run_id, run.run_id);
      assert.equal(report.through, (await owner.snapshot(run.run_id)).version);
      assert.deepEqual(await owner.usage(run.run_id), report);
      return true;
    } finally {
      RunStore.prototype.events = original;
    }
  });
}
