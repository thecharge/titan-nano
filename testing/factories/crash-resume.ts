import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import {
  CliCommand,
  CliOption,
  CrashResumeFixture,
  ExecutionPhase,
  ExitCode,
  HookFile,
  IoLimit,
  Packaging,
  ProcessSignal,
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
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendId,
  CliOutputSchema,
  ObjectSchema,
  type Run,
  type RunClient,
  RunSchema,
  type SdkProbePaths,
  VendorActivePidsSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { captureCli, stopCommand } from "../support/command.ts";
import { processStopped } from "./active-process.ts";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

function crashWorkflow() {
  const workflow = vendorRecoveryWorkflow(VendorStubMode.Complete);
  const step = workflow.steps[0];
  assert(step);
  const cause = { ...step, id: CrashResumeFixture.Cause };
  const fix = {
    ...step,
    id: CrashResumeFixture.Fix,
    do: { ...step.do, task: VendorStubMode.ActiveOnce },
  };
  return { ...workflow, steps: [cause, fix] };
}

export async function crashResume(
  backend: BackendId,
  allowance: number,
  paths: SdkProbePaths = {},
): Promise<boolean> {
  return withTemporaryDirectory((root) => crashResumeAtRoot(root, backend, allowance, paths));
}

async function crashResumeAtRoot(
  root: string,
  backend: BackendId,
  allowance: number,
  paths: SdkProbePaths,
): Promise<boolean> {
  await using resources = new AsyncDisposableStack();
  const { home, project } = await prepareSdkProject(root, backend, allowance, false, paths.vendors);
  const cli = paths.cli ?? resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource);
  const first = spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
  resources.defer(() => stopCommand(first));
  assert(await waitUntil(() => serverReady(home, first.pid), SdkProcessFixture.ObserveAttempts));
  const client = createRunClient(home);
  const submitted = await client.submit({
    project,
    workflow: crashWorkflow(),
    backend,
    client_id: CrashResumeFixture.Client,
    submission_id: CrashResumeFixture.Submission,
  });
  const work = resolve(
    submitted.root,
    RunFile.Steps,
    CrashResumeFixture.Fix,
    RunFile.AttemptPrefix + CrashResumeFixture.Attempt,
    RunFile.Work,
  );
  const state = resolve(work, VendorFixture.StateDirectory);
  const heartbeat = resolve(state, VendorFixture.Heartbeat);
  assert(
    await waitUntil(async () => {
      const run = RunSchema.parse(await client.get(submitted.run_id));
      return (
        run.nodes[CrashResumeFixture.Cause]?.state === StepStatus.Passed &&
        Boolean(run.nodes[CrashResumeFixture.Fix]?.phases[ExecutionPhase.Worker]?.session_id) &&
        (await exists(heartbeat)) &&
        (await exists(resolve(state, VendorFixture.Pids)))
      );
    }, SdkProcessFixture.ObserveAttempts),
  );
  const before = RunSchema.parse(await client.get(submitted.run_id));
  const pids = VendorActivePidsSchema.parse(
    JSON.parse(
      (await readFileBytes(resolve(state, VendorFixture.Pids), IoLimit.DataBytes)).toString(),
    ),
  );
  assert.equal(
    (await readFileBytes(resolve(work, VendorFixture.Output), IoLimit.DataBytes)).toString(),
    VendorFixture.Partial,
  );
  first.kill(ProcessSignal.Kill);
  await first.exited;
  assert(
    await waitUntil(
      async () => (await processStopped(pids.vendor)) && (await processStopped(pids.descendant)),
      SdkProcessFixture.ObserveAttempts,
    ),
  );
  const last = await readFileBytes(heartbeat, IoLimit.DataBytes);
  await Bun.sleep(VendorFixture.HeartbeatStabilityMilliseconds);
  assert(last.equals(await readFileBytes(heartbeat, IoLimit.DataBytes)));
  const next = spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
  resources.defer(() => stopCommand(next));
  assert(await waitUntil(() => serverReady(home, next.pid), SdkProcessFixture.ObserveAttempts));
  const response = await captureCli(cli, [
    CliCommand.Resume,
    submitted.run_id,
    `--${CliOption.Home}`,
    home,
    `--${CliOption.Watch}`,
    `--${CliOption.Json}`,
  ]);
  assert.equal(
    response.code,
    allowance ? ExitCode.Success : ExitCode.Blocked,
    response.error.toString(),
  );
  assert.equal(response.error.length, 0);
  const envelope = CliOutputSchema.parse(JSON.parse(response.output.toString()));
  const after = RunSchema.parse(envelope.data);
  assertResumeState(before, after, allowance);
  await assertExecutionHistory(client, before, after, allowance);
  assert.deepEqual(await client.get(submitted.run_id), after);
  if (allowance) {
    assert(after.artifacts);
    const output = await readFileBytes(
      resolve(after.artifacts, VendorFixture.Output),
      IoLimit.DataBytes,
    );
    assert.equal(output.toString(), VendorFixture.Delivered);
  } else assert.equal(after.artifacts, null);
  assert.equal(
    (await readFileBytes(resolve(project, VendorFixture.SourceFile), IoLimit.DataBytes)).toString(),
    VendorFixture.SourceContent,
  );
  return true;
}

function assertResumeState(before: Run, after: Run, allowance: number): void {
  assert.equal(after.run_id, before.run_id);
  assert.equal(after.workflow_revision, before.workflow_revision);
  assert.equal(after.state, allowance ? RunStatus.Passed : RunStatus.Blocked);
  assert.deepEqual(after.nodes[CrashResumeFixture.Cause], before.nodes[CrashResumeFixture.Cause]);
  const node = after.nodes[CrashResumeFixture.Fix];
  assert(node);
  const worker = node.phases[ExecutionPhase.Worker];
  const original = before.nodes[CrashResumeFixture.Fix]?.phases[ExecutionPhase.Worker];
  assert(worker && original);
  assert.equal(node.attempt, CrashResumeFixture.Attempt);
  assert.equal(node.refutations, 0);
  assert.deepEqual(node.evidence, []);
  assert.equal(worker.session_id, original.session_id);
  assert.equal(worker.executions, allowance ? 2 : 1);
  assert.equal(worker.retries, allowance);
  assert.equal(worker.completed, Boolean(allowance));
  assert.equal(
    node.phases[`${ExecutionPhase.FalsifierPrefix}0`]?.executions ?? 0,
    allowance ? 1 : 0,
  );
}

async function assertExecutionHistory(
  client: RunClient,
  before: Run,
  after: Run,
  allowance: number,
) {
  const page = await client.events(after.run_id);
  assert.equal(page.has_more, false);
  const starts = page.events
    .filter((event) => event.type === RunEventKind.ExecutionStarted)
    .map((event) => ObjectSchema.parse(event.data));
  const cause = starts.filter((data) => data.step_id === CrashResumeFixture.Cause);
  assert.deepEqual(
    cause.map((data) => data.execution_id),
    Object.values(before.nodes[CrashResumeFixture.Cause]?.phases ?? {}).map(
      (phase) => phase.execution_id,
    ),
  );
  const fix = starts.filter(
    (data) => data.step_id === CrashResumeFixture.Fix && data.phase === ExecutionPhase.Worker,
  );
  const original =
    before.nodes[CrashResumeFixture.Fix]?.phases[ExecutionPhase.Worker]?.execution_id;
  const current = after.nodes[CrashResumeFixture.Fix]?.phases[ExecutionPhase.Worker]?.execution_id;
  assert(original && current);
  assert.deepEqual(
    fix.map((data) => data.execution_id),
    allowance ? [original, current] : [original],
  );
  assert.equal(original === current, allowance === 0);
}
