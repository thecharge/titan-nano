import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import {
  ExecutionPhase,
  IoLimit,
  RunAction,
  RunFile,
  RunStatus,
  SdkProcessFixture,
} from "@titan/constants";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type BackendId, RunSchema, type SdkProbePaths } from "@titan/types";
import { stopCommand } from "../support/command.ts";
import { assertCandidatePhases, replaceCandidate } from "./candidate-commitment.ts";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export function candidateCommitmentProcess(
  backend: BackendId,
  changed: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) => observeCandidateProcess(root, backend, changed, paths));
}

async function observeCandidateProcess(
  root: string,
  backend: BackendId,
  changed: boolean,
  paths: SdkProbePaths,
) {
  const { home, project } = await prepareSdkProject(root, backend, 1, false, paths.vendors);
  await using resources = new AsyncDisposableStack();
  const first = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
  resources.defer(() => stopCommand(first));
  assert.ok(await waitUntil(() => serverReady(home, first.pid), SdkProcessFixture.ObserveAttempts));
  const client = createRunClient(home);
  const workflow = vendorRecoveryWorkflow();
  const created = await client.submit({
    project,
    workflow,
    backend,
    client_id: "candidate-commitment",
    submission_id: "restart",
  });
  assert.ok(
    await waitUntil(
      async () => (await client.get(created.run_id)).state === RunStatus.Blocked,
      SdkProcessFixture.ObserveAttempts,
    ),
  );
  const before = RunSchema.parse(await client.get(created.run_id));
  const node = before.nodes.deliver;
  assert.ok(node?.input);
  assert.equal(node.phases[ExecutionPhase.Worker]?.completed, true);
  const key = `${ExecutionPhase.FalsifierPrefix}0`;
  assert.equal(node.phases[key]?.completed, false);
  const input = resolve(node.input, "source.txt");
  const original = await readFileBytes(input, IoLimit.DataBytes);
  const callsPath = resolve(
    created.root,
    RunFile.Steps,
    "deliver",
    `${RunFile.AttemptPrefix}1`,
    `${RunFile.ReviewPrefix}0`,
    ".titan/vendor-fixture/calls.jsonl",
  );
  const calls = await readFileBytes(callsPath, IoLimit.DataBytes);
  await stopCommand(first);
  if (changed) await replaceCandidate(before, "deliver");
  const next = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
  resources.defer(() => stopCommand(next));
  assert.ok(await waitUntil(() => serverReady(home, next.pid), SdkProcessFixture.ObserveAttempts));
  await client.control(created.run_id, RunAction.Resume);
  assert.ok(
    await waitUntil(async () => {
      const state = (await client.get(created.run_id)).state;
      return state === RunStatus.Passed || state === RunStatus.Blocked;
    }, SdkProcessFixture.ObserveAttempts),
  );
  const after = RunSchema.parse(await client.get(created.run_id));
  const delivered = after.nodes.deliver;
  assert.ok(delivered);
  assert.equal(delivered.attempt, 1);
  assert.equal(delivered.refutations, 0);
  assert.deepEqual(delivered.evidence, []);
  if (changed) {
    assert.equal(after.state, RunStatus.Blocked);
    assert.equal(after.artifacts, null);
    assertCandidatePhases(node, delivered);
    assert.deepEqual(await readFileBytes(callsPath, IoLimit.DataBytes), calls);
    return true;
  }
  assert.equal(after.state, RunStatus.Passed);
  assert.equal(delivered.phases[ExecutionPhase.Worker]?.executions, 1);
  assert.equal(delivered.phases[key]?.executions, 2);
  assert.equal(delivered.phases[key]?.session_id, node.phases[key]?.session_id);
  assert.deepEqual(await readFileBytes(input, IoLimit.DataBytes), original);
  assert.ok(after.artifacts);
  assert.deepEqual(
    await readFileBytes(resolve(after.artifacts, "DELIVERED.txt"), IoLimit.DataBytes),
    Buffer.from("Delivered by SDK stub"),
  );
  return true;
}
