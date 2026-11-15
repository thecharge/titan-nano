import { strict as assert } from "node:assert";
import { dirname, resolve } from "node:path";
import {
  ErrorCode,
  ExecutionPhase,
  IoLimit,
  OperationalPeerFixture,
  ProcessSignal,
  RunAction,
  RunEventKind,
  RunFile,
  RunStatus,
  SdkProcessFixture,
  StepStatus,
  TextSymbol,
  VendorStubMode,
} from "@titan/constants";
import { ClaudeMessage } from "@titan/messages";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendId,
  ClaudeCreditFailureSchema,
  ObjectSchema,
  type Run,
  RunSchema,
  type SdkProbePaths,
  WorkflowSchema,
} from "@titan/types";
import { exists, readTree } from "@titan/workspace";
import { stopCommand } from "../support/command.ts";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

function peerWorkflow(worker: boolean, mode: VendorStubMode) {
  const { steps, ...base } = vendorRecoveryWorkflow(VendorStubMode.Complete);
  const step = steps[0];
  assert.ok(step);
  const check = step.falsify[0];
  assert.ok(check);
  const action = { ...step.do, task: worker ? mode : VendorStubMode.Complete };
  const verifier = { ...check, task: worker ? VendorStubMode.Complete : mode };
  const target = { ...step, do: action, falsify: [verifier] };
  const peer = { ...step, id: OperationalPeerFixture.Peer };
  const group = { parallel: [target, peer] };
  const limits = { max_parallel: OperationalPeerFixture.Parallel };
  return WorkflowSchema.parse({ ...base, steps: [group], limits });
}

function inspectPeer(run: Run, worker: boolean, blocked: boolean, executions = 1) {
  assert.equal(run.state, blocked ? RunStatus.Blocked : RunStatus.Passed);
  const peer = run.nodes[OperationalPeerFixture.Peer];
  assert.ok(peer);
  assert.equal(peer.state, StepStatus.Passed);
  const target = run.nodes[OperationalPeerFixture.Target];
  assert.ok(target?.work);
  assert.equal(target.state, blocked ? StepStatus.Blocked : StepStatus.Passed);
  assert.equal(target.attempt, OperationalPeerFixture.Attempt);
  assert.equal(target.refutations, 0);
  assert.deepEqual(target.evidence, []);
  const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
  const phase = target.phases[key];
  assert.ok(phase?.session_id);
  assert.equal(phase.executions, executions);
  assert.equal(phase.retries, executions - 1);
  assert.equal(phase.completed, !blocked);
  assert.equal(phase.next_retry, null);
  assert.equal(Boolean(phase.error), blocked);
  if (blocked) assert.equal(run.artifacts, null);
  if (!worker) assert.equal(target.phases[ExecutionPhase.Worker]?.completed, true);
  return target;
}

export async function operationalPeer(
  backend: BackendId,
  worker: boolean,
  mode: VendorStubMode,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) =>
    operationalPeerAtRoot(root, backend, worker, mode, paths),
  );
}

async function operationalPeerAtRoot(
  root: string,
  backend: BackendId,
  worker: boolean,
  mode: VendorStubMode,
  paths: SdkProbePaths,
) {
  const { home, project } = await prepareSdkProject(
    root,
    backend,
    OperationalPeerFixture.Allowance,
    false,
    paths.vendors,
  );
  const children: ReturnType<typeof spawnServer>[] = [];
  try {
    const first = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    children.push(first);
    assert.equal(
      await waitUntil(() => serverReady(home, first.pid), SdkProcessFixture.ObserveAttempts),
      true,
    );
    const client = createRunClient(home);
    const submitted = await client.submit({
      project,
      workflow: peerWorkflow(worker, mode),
      backend,
      client_id: OperationalPeerFixture.Client,
      submission_id: OperationalPeerFixture.Submission,
    });
    const blocked = mode !== VendorStubMode.Complete;
    const expected = blocked ? RunStatus.Blocked : RunStatus.Passed;
    assert.equal(
      await waitUntil(
        async () => (await client.get(submitted.run_id)).state === expected,
        SdkProcessFixture.ObserveAttempts,
      ),
      true,
    );
    const before = RunSchema.parse(await client.get(submitted.run_id));
    const target = inspectPeer(before, worker, blocked);
    assert.ok(target.work);
    const original = await readFileBytes(
      resolve(project, OperationalPeerFixture.Source),
      IoLimit.DataBytes,
    );
    assert.equal(original.toString(), OperationalPeerFixture.Original);
    assert.deepEqual(
      await readFileBytes(resolve(target.work, OperationalPeerFixture.Source), IoLimit.DataBytes),
      original,
    );
    const limits = before.config.value.limits;
    const workFiles = await readTree(target.work, limits);
    const candidate = resolve(dirname(target.work), RunFile.Candidate);
    const candidateFiles = (await exists(candidate)) ? await readTree(candidate, limits) : null;
    if (!worker || !blocked)
      assert.equal(
        (
          await readFileBytes(
            resolve(candidate, OperationalPeerFixture.Delivered),
            IoLimit.DataBytes,
          )
        ).toString(),
        OperationalPeerFixture.Content,
      );
    const peer = before.nodes[OperationalPeerFixture.Peer];
    assert.ok(peer?.work);
    assert.equal(
      (
        await readFileBytes(
          resolve(dirname(peer.work), RunFile.Candidate, OperationalPeerFixture.Delivered),
          IoLimit.DataBytes,
        )
      ).toString(),
      OperationalPeerFixture.Content,
    );
    const peerCandidate = resolve(dirname(peer.work), RunFile.Candidate);
    const peerFiles = await readTree(peerCandidate, limits);
    const events = await client.events(before.run_id);
    const failures = events.events.filter((event) => event.type === RunEventKind.ExecutionBlocked);
    assert.equal(failures.length, blocked ? 1 : 0);
    const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
    const error = target.phases[key]?.error ?? TextSymbol.Empty;
    if (mode === VendorStubMode.Exit) assert.match(error, OperationalPeerFixture.ExitEvidence);
    if (mode === VendorStubMode.BillingRetry) assert.ok(error.includes(ClaudeMessage.UnknownRetry));
    if ([VendorStubMode.QuotaExhausted, VendorStubMode.QuotaBilling].includes(mode)) {
      assert.ok(error.startsWith(`${ErrorCode.QuotaExhausted}:`));
      assert.ok(error.includes(ClaudeMessage.QuotaExhausted));
      const credits = events.events.filter(
        (event) =>
          event.type === RunEventKind.AgentEvent &&
          ClaudeCreditFailureSchema.safeParse(ObjectSchema.parse(event.data).data).success,
      );
      assert.equal(credits.length, 1);
      assert.equal(ObjectSchema.parse(credits[0]?.data).phase, key);
    }
    if (blocked) {
      const failure = ObjectSchema.parse(failures[0]?.data);
      assert.equal(failure.step_id, OperationalPeerFixture.Target);
      assert.equal(failure.reason, error);
    }
    const usage = await client.usage(before.run_id);
    assert.equal(usage.executions, blocked && worker ? 3 : 4);
    first.kill(ProcessSignal.Kill);
    await first.exited;
    const next = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    children.push(next);
    assert.equal(
      await waitUntil(() => serverReady(home, next.pid), SdkProcessFixture.ObserveAttempts),
      true,
    );
    const restored = RunSchema.parse(await client.get(before.run_id));
    inspectPeer(restored, worker, blocked);
    assert.deepEqual(restored.nodes, before.nodes);
    assert.deepEqual(await readTree(target.work, limits), workFiles);
    assert.deepEqual(await readTree(peerCandidate, limits), peerFiles);
    if (candidateFiles) assert.deepEqual(await readTree(candidate, limits), candidateFiles);
    assert.equal(restored.version, before.version);
    assert.deepEqual(await client.usage(before.run_id), usage);
    assert.deepEqual(await client.events(before.run_id), events);
    assert.deepEqual(
      await readFileBytes(resolve(project, OperationalPeerFixture.Source), IoLimit.DataBytes),
      original,
    );
    if (blocked) {
      await client.control(before.run_id, RunAction.Resume);
      assert.equal(
        await waitUntil(async () => {
          const state = RunSchema.parse(await client.get(before.run_id));
          return state.state === RunStatus.Blocked && state.version > before.version;
        }, SdkProcessFixture.ObserveAttempts),
        true,
      );
      const resumed = RunSchema.parse(await client.get(before.run_id));
      inspectPeer(resumed, worker, blocked, 2);
      assert.deepEqual(resumed.nodes[OperationalPeerFixture.Peer], peer);
      assert.equal(
        resumed.nodes[OperationalPeerFixture.Target]?.phases[key]?.session_id,
        target.phases[key]?.session_id,
      );
      assert.deepEqual(await readTree(target.work, limits), workFiles);
      assert.equal((await client.usage(before.run_id)).executions, usage.executions + 1);
    }
    if (candidateFiles) assert.deepEqual(await readTree(candidate, limits), candidateFiles);
    assert.equal(await exists(resolve(project, OperationalPeerFixture.Delivered)), false);
    return true;
  } finally {
    for (const child of children) await stopCommand(child);
  }
}
