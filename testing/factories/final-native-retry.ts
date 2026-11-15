import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import {
  Backend,
  ClaudeEventKind,
  ErrorCode,
  ExecutionPhase,
  FileEncoding,
  FinalAttemptFixture,
  IoLimit,
  OperationalPeerFixture,
  ProcessSignal,
  RunAction,
  RunEventKind,
  RunFile,
  RunStatus,
  SdkProcessFixture,
  StepStatus,
  VendorFixture,
  VendorStubMode,
} from "@titan/constants";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { processExited, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ObjectSchema,
  type Run,
  RunSchema,
  type SdkProbePaths,
  VendorStubCallSchema,
} from "@titan/types";
import { exists, readTree } from "@titan/workspace";
import { stopCommand } from "../support/command.ts";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

function finalWorkflow(worker: boolean, blocked: boolean) {
  const task = worker
    ? blocked
      ? VendorStubMode.FinalWorkerBlocked
      : VendorStubMode.FinalWorkerRetry
    : blocked
      ? VendorStubMode.FinalCheckerBlocked
      : VendorStubMode.FinalCheckerRetry;
  const workflow = vendorRecoveryWorkflow(task);
  for (const step of workflow.steps) step.do.task = task;
  return { ...workflow, defaults: { max_attempts: FinalAttemptFixture.Attempt } };
}

function inspectFinal(run: Run, worker: boolean, blocked: boolean) {
  const node = run.nodes[OperationalPeerFixture.Target];
  assert.ok(node?.work);
  assert.equal(node.attempt, FinalAttemptFixture.Attempt);
  assert.equal(node.refutations, FinalAttemptFixture.Refutations);
  assert.deepEqual(node.evidence, FinalAttemptFixture.Evidence);
  const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
  const phase = node.phases[key];
  assert.ok(phase?.session_id && phase.execution_id);
  assert.equal(phase.executions, blocked ? 1 : 2);
  assert.equal(phase.retries, blocked ? 0 : 1);
  assert.equal(phase.completed, !blocked);
  assert.equal(phase.error?.startsWith(`${ErrorCode.RateLimited}:`) ?? false, blocked);
  if (blocked) assert.ok(phase.next_retry !== null);
  else assert.equal(phase.next_retry, null);
  if (!worker) assert.equal(node.phases[ExecutionPhase.Worker]?.executions, 1);
  return { node, phase, key };
}

async function inspectFinalHistory(run: Run, worker: boolean, blocked: boolean) {
  let rateTime = 0;
  let refutations = 0;
  let interruptions = 0;
  for await (const event of RunStore.forRun(run.project, run.run_id).events()) {
    assert.notEqual(event.type, RunEventKind.StepFailed);
    if (event.type === RunEventKind.ResultRefuted) refutations++;
    if (
      event.type === RunEventKind.AgentEvent &&
      ObjectSchema.parse(ObjectSchema.parse(event.data).data).subtype === ClaudeEventKind.ApiRetry
    )
      rateTime = event.time;
    if (event.type !== (blocked ? RunEventKind.ExecutionBlocked : RunEventKind.ExecutionRecovering))
      continue;
    interruptions++;
    const { phase } = inspectFinal(event.state, worker, true);
    const next = ObjectSchema.parse(event.data).next_retry;
    assert.equal(next, phase.next_retry);
    assert.ok(typeof next === "number" && rateTime > 0);
    assert.ok(next >= rateTime + (blocked ? FinalAttemptFixture.RetryDelayMilliseconds : 1));
  }
  assert.equal(refutations, FinalAttemptFixture.Refutations);
  assert.equal(interruptions, 1);
}

export async function finalAttemptRetry(
  worker: boolean,
  blocked: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) => finalAttemptAtRoot(root, worker, blocked, paths));
}

async function finalAttemptAtRoot(
  root: string,
  worker: boolean,
  blocked: boolean,
  paths: SdkProbePaths,
) {
  const { home, project } = await prepareSdkProject(
    root,
    Backend.Claude,
    blocked ? 0 : 1,
    false,
    paths.vendors,
  );
  const children: ReturnType<typeof spawnServer>[] = [];
  try {
    const first = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    children.push(first);
    assert.ok(
      await waitUntil(() => serverReady(home, first.pid), SdkProcessFixture.ObserveAttempts),
    );
    const client = createRunClient(home);
    const submitted = await client.submit({
      project,
      workflow: finalWorkflow(worker, blocked),
      backend: Backend.Claude,
      client_id: FinalAttemptFixture.Client,
      submission_id: FinalAttemptFixture.Submission,
    });
    const expected = blocked ? RunStatus.Blocked : RunStatus.Passed;
    assert.ok(
      await waitUntil(
        async () => (await client.get(submitted.run_id)).state === expected,
        SdkProcessFixture.ObserveAttempts,
      ),
    );
    const before = RunSchema.parse(await client.get(submitted.run_id));
    const { node, phase } = inspectFinal(before, worker, blocked);
    assert.equal(node.state, blocked ? StepStatus.Blocked : StepStatus.Passed);
    assert.equal(before.config.value.defaults.max_attempts, FinalAttemptFixture.Attempt);
    if (blocked) assert.ok(phase.next_retry !== null && phase.next_retry > Date.now());
    assert.ok(node.work);
    await inspectFinalHistory(before, worker, blocked);
    const cwd = worker ? node.work : resolve(node.work, "..", `${RunFile.ReviewPrefix}0`);
    const calls = (
      await readFileBytes(
        resolve(cwd, VendorFixture.StateDirectory, "calls.jsonl"),
        IoLimit.DataBytes,
      )
    )
      .toString(FileEncoding.Utf8)
      .trim()
      .split("\n")
      .map((line) => VendorStubCallSchema.parse(JSON.parse(line)));
    assert.equal(calls.length, phase.executions);
    assert.equal(calls[0]?.resume, false);
    for (const call of calls.slice(1)) assert.equal(call.resume, true);
    for (const call of calls) assert.ok(await waitUntil(() => processExited(call.pid)));
    const usage = await client.usage(before.run_id);
    assert.equal(usage.executions, blocked ? (worker ? 5 : 6) : 7);
    assert.equal(usage.unreported_executions, 1);
    const limits = before.config.value.limits;
    const workFiles = await readTree(node.work, limits);
    const candidate = resolve(node.work, "..", RunFile.Candidate);
    const candidateFiles = (await exists(candidate)) ? await readTree(candidate, limits) : null;
    const events = await client.events(before.run_id);
    first.kill(ProcessSignal.Kill);
    await first.exited;
    const next = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    children.push(next);
    assert.ok(
      await waitUntil(() => serverReady(home, next.pid), SdkProcessFixture.ObserveAttempts),
    );
    const restored = RunSchema.parse(await client.get(before.run_id));
    assert.equal(restored.state, expected);
    assert.deepEqual(restored.nodes, before.nodes);
    assert.deepEqual(await client.usage(before.run_id), usage);
    assert.deepEqual(await client.events(before.run_id), events);
    if (blocked) {
      await client.control(before.run_id, RunAction.Resume);
      assert.ok(
        await waitUntil(
          async () => (await client.get(before.run_id)).state === RunStatus.Recovering,
        ),
      );
      await client.control(before.run_id, RunAction.Pause);
      const paused = RunSchema.parse(await client.get(before.run_id));
      assert.equal(paused.state, RunStatus.Paused);
      assert.deepEqual(paused.nodes[OperationalPeerFixture.Target]?.phases, node.phases);
      assert.equal(
        paused.nodes[OperationalPeerFixture.Target]?.attempt,
        FinalAttemptFixture.Attempt,
      );
      assert.deepEqual(
        paused.nodes[OperationalPeerFixture.Target]?.evidence,
        FinalAttemptFixture.Evidence,
      );
      assert.equal((await client.usage(before.run_id)).executions, usage.executions);
    }
    assert.deepEqual(await readTree(node.work, limits), workFiles);
    if (candidateFiles) assert.deepEqual(await readTree(candidate, limits), candidateFiles);
    if (!blocked) {
      assert.ok(before.artifacts);
      assert.equal(
        (
          await readFileBytes(
            resolve(before.artifacts, OperationalPeerFixture.Delivered),
            IoLimit.DataBytes,
          )
        ).toString(),
        OperationalPeerFixture.Content,
      );
    }
    assert.equal(
      (
        await readFileBytes(resolve(project, OperationalPeerFixture.Source), IoLimit.DataBytes)
      ).toString(),
      OperationalPeerFixture.Original,
    );
    assert.equal(await exists(resolve(project, OperationalPeerFixture.Delivered)), false);
    return true;
  } finally {
    for (const child of children) await stopCommand(child);
  }
}
