import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveConfig } from "@titan/config";
import {
  ExecutionPhase,
  FileEncoding,
  IoLimit,
  RunEventKind,
  RunStatus,
  VendorFixture,
  VendorStubMode,
  WorkspaceModeSetting,
} from "@titan/constants";
import { all } from "@titan/core";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { processExited, waitUntil } from "@titan/test-framework";
import {
  type BackendFactory,
  type BackendId,
  type EventPage,
  type Run,
  type RunUsage,
  VendorPhaseEventSchema,
  VendorStubCallSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { vendorRecoveryWorkflow } from "./vendor-recovery.ts";

export async function observeVendorRetry(
  factory: BackendFactory,
  backend: BackendId,
  root: string,
  worker: boolean,
  task: VendorStubMode,
  allowance: number,
) {
  const project = join(root, "project");
  const home = join(root, "home");
  await all([() => mkdir(project), () => mkdir(home)]);
  await writeFile(join(project, "source.txt"), Buffer.from("Original project content"));
  const workflow = vendorRecoveryWorkflow(worker ? VendorStubMode.Complete : task);
  if (worker) for (const step of workflow.steps) step.do.task = task;
  const engine = new Engine(factory);
  const overrides = {
    defaults: { max_attempts: 1, claude_max_turns: 3 },
    recovery: {
      max_retries: allowance,
      base_delay_s: 0.001,
      max_delay_s: 0.002,
      jitter_ratio: 0,
    },
  };
  const config = await resolveConfig({ home, project, overrides });
  const run = await engine.create({
    project,
    plan: validateWorkflow(workflow),
    config,
    backend,
    client_id: "retry-contract",
    submission_id: "retry-contract",
  });
  await engine.start(run.run_id);
  const node = run.nodes.deliver;
  assert.ok(node);
  const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
  const phase = node.phases[key];
  assert.ok(phase);
  const usage = await engine.usage(run.run_id);
  const events = await engine.events(run.run_id);
  const recovered = new Engine(factory);
  const restored = await recovered.load(run.root);
  assert.deepEqual(await recovered.usage(run.run_id), usage);
  if (run.state === RunStatus.Blocked && phase.retries >= allowance) {
    await recovered.resume(run.run_id);
    assert.equal(restored.nodes.deliver?.phases[key]?.executions, phase.executions);
    assert.equal(restored.nodes.deliver?.attempt, 1);
    assert.deepEqual(restored.nodes.deliver?.evidence, []);
  }
  return inspectVendorRetry(run, events, usage, worker);
}

export async function inspectVendorRetry(
  run: Run,
  events: EventPage,
  usage: RunUsage,
  worker: boolean,
) {
  const node = run.nodes.deliver;
  assert.ok(node?.work);
  assert.equal(node.attempt, 1);
  assert.equal(node.refutations, 0);
  assert.deepEqual(node.evidence, []);
  const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
  const phase = node.phases[key];
  assert.ok(phase?.session_id);
  const live =
    (run.config.value.workspace?.mode ?? WorkspaceModeSetting.Live) === WorkspaceModeSetting.Live;
  const cwd = live || worker ? node.work : join(run.root, "steps/deliver/attempt-1/review-0");
  assert.equal(events.has_more, false);
  for (const event of events.events) {
    if (event.type !== RunEventKind.AgentEvent) continue;
    const retained = VendorPhaseEventSchema.parse(event.data);
    if (retained.phase === key && retained.session_id)
      assert.equal(retained.session_id, phase.session_id);
  }
  assert.equal(
    usage.executions,
    Object.values(node.phases).reduce((sum, entry) => sum + entry.executions, 0),
  );
  assert.equal(
    usage.reported_executions,
    Object.values(node.phases).reduce((sum, entry) => sum + entry.usage.length, 0),
  );
  assert.equal(usage.unreported_executions, usage.executions - usage.reported_executions);
  assert.deepEqual(usage.complete, { input_tokens: false, output_tokens: false, cost_usd: false });
  assert.deepEqual(usage.known, {
    input_tokens: run.state === RunStatus.Passed ? 12 : worker ? 0 : 4,
    output_tokens: run.state === RunStatus.Passed ? 6 : worker ? 0 : 2,
    cost_usd: 0,
  });
  const allCalls = (
    await readFileBytes(join(cwd, VendorFixture.StateDirectory, "calls.jsonl"), IoLimit.DataBytes)
  )
    .toString(FileEncoding.Utf8)
    .trim()
    .split("\n")
    .map((line) => VendorStubCallSchema.parse(JSON.parse(line)));
  if (live) assert.equal(allCalls.length, usage.executions);
  const calls = (
    await readFileBytes(
      join(cwd, VendorFixture.StateDirectory, `${worker ? "worker" : "checker"}-calls.jsonl`),
      IoLimit.DataBytes,
    )
  )
    .toString(FileEncoding.Utf8)
    .trim()
    .split("\n")
    .map((line) => VendorStubCallSchema.parse(JSON.parse(line)));
  assert.equal(calls.length, phase.executions);
  assert.equal(calls[0]?.resume, false);
  assert.equal(
    calls.slice(1).every((call) => call.resume),
    true,
  );
  for (const call of allCalls) assert.equal(await waitUntil(() => processExited(call.pid)), true);
  assert.equal(
    (await readFileBytes(join(run.project, "source.txt"), IoLimit.DataBytes)).equals(
      Buffer.from("Original project content"),
    ),
    true,
  );
  if (run.state === RunStatus.Passed) {
    assert.ok(run.artifacts);
    assert.equal(
      (await readFileBytes(join(run.artifacts, "DELIVERED.txt"), IoLimit.DataBytes)).equals(
        Buffer.from("Delivered by SDK stub"),
      ),
      true,
    );
  }
  return {
    passed: run.state === RunStatus.Passed,
    executions: phase.executions,
    retries: phase.retries,
    recoveries: events.events.filter((event) => event.type === RunEventKind.ExecutionRecovering)
      .length,
    error: phase.error?.split(":")[0] ?? null,
  };
}
