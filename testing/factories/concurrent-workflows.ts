import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import {
  AgentTool,
  Backend,
  ConcurrentWorkflowFixture,
  ErrorCode,
  ExecutionPhase,
  IoLimit,
  RunAction,
  RunStatus,
  SignalEvent,
  Verdict,
} from "@titan/constants";
import { all } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type Run, RunSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { writeIsolatedHome } from "../support/isolated.ts";
import { checkedWorkflow } from "./hardening.ts";

export function concurrentWorkflowIsolation(mode: ConcurrentWorkflowFixture): Promise<boolean> {
  return withTemporaryDirectory((root) => concurrentWorkflows(root, mode));
}

async function concurrentWorkflows(
  root: string,
  mode: ConcurrentWorkflowFixture,
): Promise<boolean> {
  await using resources = new AsyncDisposableStack();
  const home = resolve(root, "home");
  const release = Promise.withResolvers<void>();
  const workspaces = new Map<string, string>();
  let selected = "";
  const backend = new FakeBackend(async (spec, _prompt, signal) => {
    if (!spec.writable)
      return { json: { verdict: Verdict.Survived, evidence: "Independent check" } };
    assert.ok(workspaces.size < 2);
    assert.equal(workspaces.has(spec.run_id), false);
    workspaces.set(spec.run_id, spec.cwd);
    await holdConcurrentWorker(release.promise, signal);
    signal.throwIfAborted();
    if (mode === ConcurrentWorkflowFixture.OperationalStop && spec.run_id === selected)
      throw new OperationalError(ErrorCode.FakeUnscripted, "Deliberate isolated operational stop");
    await writeFile(resolve(spec.cwd, "delivery.txt"), Buffer.from(spec.run_id));
    return { json: { note: spec.run_id } };
  });
  await writeIsolatedHome(home);
  const server = await startServer(home, () => backend);
  resources.defer(() => server.stop());
  resources.defer(() => release.resolve());
  const client = createRunClient(home);
  const base = checkedWorkflow();
  const worker = { ...base.personas.worker, tools: [AgentTool.Write] };
  const workflow = { ...base, personas: { ...base.personas, worker } };
  const submit = async (name: string) => {
    const project = resolve(
      root,
      mode === ConcurrentWorkflowFixture.SeparateProjects ? name : "project",
    );
    await mkdir(project, { recursive: true });
    return RunSchema.parse(
      await client.submit({
        project,
        workflow: { ...workflow, goal: name },
        backend: Backend.Fake,
        client_id: name,
        submission_id: "shared-submission",
        harness_session_id: `${name}-session`,
      }),
    );
  };
  const [first, second] = await all([() => submit("first"), () => submit("second")]);
  assert.ok(first && second);
  selected = first.run_id;
  assert.equal(first.client_id, "first");
  assert.equal(second.client_id, "second");
  assert.equal(first.harness_session_id, "first-session");
  assert.equal(second.harness_session_id, "second-session");
  assert.equal(first.submission_id, "shared-submission");
  assert.equal(second.submission_id, "shared-submission");
  assert.equal(first.plan.workflow.goal, "first");
  assert.equal(second.plan.workflow.goal, "second");
  assert.notEqual(first.run_id, second.run_id);
  assert.ok(await waitUntil(async () => workspaces.size === 2));
  const heldFirst = RunSchema.parse(await client.get(first.run_id));
  const heldSecond = RunSchema.parse(await client.get(second.run_id));
  assert.equal(heldFirst.state, RunStatus.Running);
  assert.equal(heldSecond.state, RunStatus.Running);
  assert.notEqual(
    heldFirst.nodes.one?.phases[ExecutionPhase.Worker]?.session_id,
    heldSecond.nodes.one?.phases[ExecutionPhase.Worker]?.session_id,
  );
  assert.notEqual(workspaces.get(first.run_id), workspaces.get(second.run_id));
  if (mode === ConcurrentWorkflowFixture.Cancel) {
    await client.control(first.run_id, RunAction.Cancel);
    assert.equal((await client.get(second.run_id)).state, RunStatus.Running);
  }
  const expected = firstConcurrentState(mode);
  release.resolve();
  assert.ok(await waitUntil(async () => (await client.get(first.run_id)).state === expected));
  assert.ok(
    await waitUntil(async () => (await client.get(second.run_id)).state === RunStatus.Passed),
  );
  await verifyConcurrentRecord(heldFirst, expected);
  await verifyConcurrentRecord(heldSecond, RunStatus.Passed);
  assert.equal(workspaces.size, 2);
  assert.equal((await client.list()).runs.length, 2);
  assert.deepEqual(
    (await client.list({ client_id: first.client_id })).runs.map((run) => run.run_id),
    [first.run_id],
  );
  assert.deepEqual(
    (await client.list({ client_id: second.client_id })).runs.map((run) => run.run_id),
    [second.run_id],
  );
  return true;
}

function firstConcurrentState(mode: ConcurrentWorkflowFixture): RunStatus {
  if (mode === ConcurrentWorkflowFixture.Cancel) return RunStatus.Cancelled;
  if (mode === ConcurrentWorkflowFixture.OperationalStop) return RunStatus.Blocked;
  return RunStatus.Passed;
}

async function holdConcurrentWorker(release: Promise<void>, signal: AbortSignal): Promise<void> {
  const gate = Promise.withResolvers<void>();
  const abort = (): void => gate.reject(signal.reason);
  signal.addEventListener(SignalEvent.Abort, abort, { once: true });
  try {
    signal.throwIfAborted();
    void release.then(gate.resolve, gate.reject);
    await gate.promise;
  } finally {
    signal.removeEventListener(SignalEvent.Abort, abort);
  }
}

async function verifyConcurrentRecord(original: Run, expected: RunStatus): Promise<void> {
  const store = new RunStore(original.root);
  const run = await store.read();
  assert.equal(run.state, expected);
  assert.equal(run.plan.workflow.goal, original.plan.workflow.goal);
  const node = run.nodes.one;
  assert.ok(node);
  assert.equal(node.attempt, 1);
  assert.equal(node.refutations, 0);
  assert.equal(node.phases[ExecutionPhase.Worker]?.executions, 1);
  assert.ok(node.phases[ExecutionPhase.Worker]?.session_id);
  assert.equal(
    node.phases[ExecutionPhase.Worker]?.session_id,
    original.nodes.one?.phases[ExecutionPhase.Worker]?.session_id,
  );
  assert.equal(
    node.phases[ExecutionPhase.Worker]?.execution_id,
    original.nodes.one?.phases[ExecutionPhase.Worker]?.execution_id,
  );
  assert.equal(await exists(resolve(run.project, "delivery.txt")), false);
  if (expected === RunStatus.Passed) {
    assert.deepEqual(node.output, { note: run.run_id });
    assert.ok(node.work);
    assert.equal(
      (await readFileBytes(resolve(node.work, "delivery.txt"), IoLimit.DataBytes)).toString(),
      run.run_id,
    );
  }
  let events = 0;
  for await (const event of store.events()) {
    assert.equal(event.state.run_id, run.run_id);
    assert.equal(event.state.client_id, original.client_id);
    assert.equal(event.state.submission_id, original.submission_id);
    assert.equal(event.state.harness_session_id, original.harness_session_id);
    assert.equal(event.state.plan.workflow.goal, original.plan.workflow.goal);
    events++;
  }
  assert.equal(events, run.version);
}
