import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  ErrorCode,
  ErrorField,
  ExecutionPhase,
  FileErrorCode,
  IoLimit,
  RequestDecision,
  RequestFormat,
  RunAction,
  RunFormat,
  RunStatus,
  TitanRelease,
  VendorFixture,
  VendorStubMode,
} from "@titan/constants";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendId,
  RunSchema,
  type SdkProbePaths,
  VendorActivePidsSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { stopCommand } from "../support/command.ts";
import { executionRequest } from "./request-execution.ts";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function activeProcessRecovery(
  backend: BackendId,
  cancel: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) =>
    activeProcessRecoveryAtRoot(root, backend, cancel, paths),
  );
}

async function activeProcessRecoveryAtRoot(
  root: string,
  backend: BackendId,
  cancel: boolean,
  paths: SdkProbePaths,
) {
  const { home, project } = await prepareSdkProject(root, backend, 1, false, paths.vendors);
  const children: ReturnType<typeof spawnServer>[] = [];
  try {
    const first = spawnServer(home, paths.cli, 15000);
    children.push(first);
    if (!(await waitUntil(() => serverReady(home, first.pid), 300)))
      throw new Error("Active daemon not ready");
    const client = createRunClient(home);
    const workflow = vendorRecoveryWorkflow(VendorStubMode.Complete);
    for (const step of workflow.steps) step.do.task = VendorStubMode.ActiveOnce;
    const run = RunSchema.parse(
      await client.submit({
        project,
        workflow,
        backend,
        client_id: "active",
        submission_id: "recovery",
      }),
    );
    const work = resolve(run.root, "steps/deliver/attempt-1/work");
    const heartbeat = resolve(work, VendorFixture.StateDirectory, VendorFixture.Heartbeat);
    const pidFile = resolve(work, VendorFixture.StateDirectory, VendorFixture.Pids);
    if (
      !(await waitUntil(
        async () =>
          (await exists(heartbeat)) &&
          (await exists(pidFile)) &&
          Boolean(
            RunSchema.parse(await client.get(run.run_id)).nodes.deliver?.phases[
              ExecutionPhase.Worker
            ]?.session_id,
          ),
        300,
      ))
    )
      throw new Error("Active descendant never wrote");
    const before = RunSchema.parse(await client.get(run.run_id));
    const native = before.nodes.deliver?.phases[ExecutionPhase.Worker]?.session_id;
    if (!native) throw new Error("Active native id not committed");
    for (let index = 0; index < 3; index++)
      assert.deepEqual(await client.control(run.run_id, RunAction.Resume), before);
    assert.deepEqual(await client.get(run.run_id), before);
    const requests = createRequestClient(home);
    const input = executionRequest(before, "deliver", ExecutionPhase.Worker);
    const request = await requests.open(run.run_id, input);
    assert.equal(request.schema_version, RequestFormat.Execution);
    if (cancel) await client.control(run.run_id, RunAction.Cancel);
    else {
      first.kill("SIGKILL");
      await first.exited;
    }
    const pids = VendorActivePidsSchema.parse(
      JSON.parse((await readFileBytes(pidFile, IoLimit.AddressBytes)).toString()),
    );
    const stopped =
      (await waitUntil(
        async () => (await processStopped(pids.vendor)) && (await processStopped(pids.descendant)),
        300,
      )) && (await stoppedHeartbeat(heartbeat));
    if (!cancel) {
      const second = spawnServer(home, paths.cli, 15000);
      children.push(second);
      assert(
        await waitUntil(() => serverReady(home, second.pid), 300),
        "Replacement daemon not ready",
      );
      await client.control(run.run_id, RunAction.Resume);
    }
    if (
      !(await waitUntil(async () => {
        const state = (await client.get(run.run_id)).state;
        return (
          state === RunStatus.Passed || state === RunStatus.Blocked || state === RunStatus.Cancelled
        );
      }, 300))
    )
      throw new Error("Active recovery did not settle");
    const after = RunSchema.parse(await client.get(run.run_id));
    const node = after.nodes.deliver;
    assert.equal(
      after.schema_version,
      after.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
    );
    assert.equal(after.runtime_version, TitanRelease);
    assert.equal(after.runtime_version, run.runtime_version);
    assert.deepEqual(await requests.open(run.run_id, input), request);
    const beforeRefusal = after.version;
    const late = await thrownBy(() =>
      requests.open(run.run_id, { ...input, request_id: "late-phase-request" }),
    );
    assert.ok(late);
    assert.equal(Reflect.get(Object(late), ErrorField.Code), ErrorCode.PermissionDenied);
    assert.equal((await client.get(run.run_id)).version, beforeRefusal);
    const answered = await requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: RequestDecision.Approve,
        reason: "Reviewed retained native origin",
        client_id: "active-reviewer",
      },
      ApprovalLevel.Main,
    );
    assert.deepEqual(answered.origin, request.origin);
    assert.deepEqual(await requests.open(run.run_id, input), answered);
    return {
      requestPreserved: true,
      staleRequestRefused: true,
      state: after.state,
      stopped,
      sessionPreserved: native === node?.phases[ExecutionPhase.Worker]?.session_id,
      executions: node?.phases[ExecutionPhase.Worker]?.executions,
      attempt: node?.attempt,
      refutations: node?.refutations,
      delivered:
        after.artifacts !== null &&
        (
          await readFileBytes(resolve(after.artifacts, VendorFixture.Output), IoLimit.DataBytes)
        ).toString() === VendorFixture.Delivered,
      originalPreserved:
        (
          await readFileBytes(resolve(project, VendorFixture.SourceFile), IoLimit.DataBytes)
        ).toString() === VendorFixture.SourceContent,
    };
  } finally {
    for (const child of children) await stopCommand(child);
  }
}
async function stoppedHeartbeat(path: string) {
  const last = await readFileBytes(path, IoLimit.DataBytes);
  await Bun.sleep(VendorFixture.HeartbeatStabilityMilliseconds);
  return last.equals(await readFileBytes(path, IoLimit.DataBytes));
}

export async function processStopped(pid: number) {
  return processStateStopped(`/proc/${pid}/stat`);
}

async function processStateStopped(path: string, read = readFileBytes) {
  try {
    return /\) [ZX] /.test((await read(path, IoLimit.AddressBytes)).toString());
  } catch (error) {
    if (
      error instanceof Error &&
      (Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing ||
        Reflect.get(error, ErrorField.Code) === FileErrorCode.NoProcess)
    )
      return true;
    throw error;
  }
}

export async function processStateError(code: FileErrorCode) {
  return processStateStopped("/proc/fixture/stat", async () => {
    throw Object.assign(new Error("Process state fixture read failed"), { code });
  });
}

export async function processStateEvidence(state: string | null) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, "stat");
    if (state === "directory") await mkdir(path);
    else if (state !== null) await writeFile(path, Buffer.from(`123 (worker) ${state} 1 2`));
    return processStateStopped(path);
  });
}
