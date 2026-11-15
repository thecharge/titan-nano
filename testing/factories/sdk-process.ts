import { strict as assert } from "node:assert";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AgentRuntime,
  Backend,
  ConfigFile,
  ExecutionPhase,
  type NativeToolTransport,
  Packaging,
  RunStatus,
  SdkProcessFixture,
  VendorFixture,
  VendorStubMode,
  WorkspaceModeSetting,
} from "@titan/constants";
import { serveUntilStopped } from "@titan/runtime";
import { call } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendId,
  PersonaInspectionSchema,
  type Phase,
  RunSchema,
  type SdkProbePaths,
} from "@titan/types";
import { runCliCommand } from "../support/command.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function sdkProcessRecovery(
  backend: BackendId,
  crash: boolean,
  allowance: number,
  task: VendorStubMode = VendorStubMode.RecoverOnce,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) =>
    sdkProcessRecoveryAtRoot(root, backend, crash, allowance, task, paths),
  );
}

async function sdkProcessRecoveryAtRoot(
  root: string,
  backend: BackendId,
  crash: boolean,
  allowance: number,
  task: VendorStubMode,
  paths: SdkProbePaths,
) {
  const { home, project } = await prepareSdkProject(root, backend, allowance, false, paths.vendors);
  const children: ReturnType<typeof spawnServer>[] = [];
  try {
    const first = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    children.push(first);
    if (!(await waitUntil(() => serverReady(home, first.pid), SdkProcessFixture.ObserveAttempts)))
      throw new Error("SDK daemon did not start");
    const workflow = vendorRecoveryWorkflow(task);
    const run = RunSchema.parse(
      await call(home, "/runs", "POST", {
        project,
        workflow,
        backend,
        client_id: "sdk-process",
        submission_id: "recovery",
      }),
    );
    const blocked = await waitUntil(async () => {
      const observed = RunSchema.parse(await call(home, `/runs/${run.run_id}`));
      return observed.state === RunStatus.Blocked;
    }, SdkProcessFixture.ObserveAttempts);
    if (!blocked) throw new Error("SDK checker interruption was not recorded");
    const before = RunSchema.parse(await call(home, `/runs/${run.run_id}`));
    assert.deepEqual(before.nodes.deliver?.evidence, []);
    const checkerBefore = before.nodes.deliver?.phases[`${ExecutionPhase.FalsifierPrefix}0`];
    const checkpoint = resolve(run.root, "steps/deliver/attempt-1/candidate.hash");
    const hash = await readFile(checkpoint);
    first.kill(crash ? "SIGKILL" : "SIGTERM");
    await first.exited;
    const next = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    children.push(next);
    if (!(await waitUntil(() => serverReady(home, next.pid), SdkProcessFixture.ObserveAttempts)))
      throw new Error("SDK daemon did not restart");
    await call(home, `/runs/${run.run_id}/resume`, "POST", {});
    const finished = await waitUntil(async () => {
      const state = RunSchema.parse(await call(home, `/runs/${run.run_id}`)).state;
      return state === RunStatus.Passed || state === RunStatus.Blocked;
    }, SdkProcessFixture.ObserveAttempts);
    if (!finished) throw new Error("SDK recovery did not settle");
    const after = RunSchema.parse(await call(home, `/runs/${run.run_id}`));
    const node = after.nodes.deliver;
    assert.deepEqual(node?.evidence, []);
    const checker = node?.phases[`${ExecutionPhase.FalsifierPrefix}0`];
    const usage = await createRunClient(home).usage(run.run_id);
    const reported = Object.values(node?.phases ?? {}).reduce(
      (total, phase) => total + phase.usage.length,
      0,
    );
    assert.equal(usage.through, after.version);
    assert.equal(usage.executions, allowance ? 3 : 2);
    assert.equal(usage.reported_executions, reported);
    assert.equal(usage.unreported_executions, usage.executions - reported);
    const charged =
      reported + (backend === Backend.Claude && after.state === RunStatus.Passed ? 1 : 0);
    assert.deepEqual(usage.known, {
      input_tokens: charged * 4,
      output_tokens: charged * 2,
      cost_usd: 0,
    });
    assert.deepEqual(usage.complete, {
      input_tokens: false,
      output_tokens: false,
      cost_usd: false,
    });
    for (const [persona, key] of Object.entries({
      worker: ExecutionPhase.Worker,
      checker: `${ExecutionPhase.FalsifierPrefix}0`,
    })) {
      const reference = after.persona_references?.[persona];
      assert(reference);
      const page = PersonaInspectionSchema.parse(
        await runCliCommand(paths.cli ?? Packaging.CliSource, home, ["persona", "show", reference]),
      );
      const saved = page.versions[0]?.usage;
      const phase: Phase | undefined = node?.phases[key];
      assert(saved);
      assert(phase);
      assert.equal(saved.history_complete, true);
      assert.equal(saved.executions, phase.dispatches ?? phase.executions);
      assert.equal(saved.reported_executions, phase.usage.length);
      assert.equal(saved.unreported_executions, saved.executions - saved.reported_executions);
      assert.equal(saved.reports.length, 1);
      assert.equal(saved.reports[0]?.run_id, run.run_id);
      assert((saved.reports[0]?.through ?? Number.POSITIVE_INFINITY) <= after.version);
      assert.deepEqual(saved.known, {
        input_tokens: persona === "worker" ? 4 : usage.known.input_tokens - 4,
        output_tokens: persona === "worker" ? 2 : usage.known.output_tokens - 2,
        cost_usd: 0,
      });
      assert.deepEqual(saved.complete, {
        input_tokens: persona === "worker",
        output_tokens: persona === "worker",
        cost_usd: persona === "worker" && backend === Backend.Claude,
      });
    }
    return {
      passed: after.state === RunStatus.Passed,
      attempt: node?.attempt,
      refutations: node?.refutations,
      workerExecutions: node?.phases[ExecutionPhase.Worker]?.executions,
      checkerExecutions: checker?.executions,
      sessionPreserved:
        Boolean(checkerBefore?.session_id) && checkerBefore?.session_id === checker?.session_id,
      checkpointPreserved: hash.equals(await readFile(checkpoint)),
      delivered:
        after.artifacts !== null &&
        (await readFile(resolve(after.artifacts, "DELIVERED.txt"))).equals(
          Buffer.from("Delivered by SDK stub"),
        ),
      artifactClean:
        after.artifacts === null ||
        JSON.stringify((await readdir(after.artifacts)).sort()) ===
          JSON.stringify(["DELIVERED.txt", "source.txt"]),
      originalPreserved: (await readFile(resolve(project, "source.txt"))).equals(
        Buffer.from("Original project content"),
      ),
    };
  } finally {
    await stopSdkChildren(children);
  }
}

export async function prepareSdkProject(
  root: string,
  backend: BackendId,
  allowance: number,
  missing = false,
  vendors = resolve("testing/fixtures/vendors"),
  transport?: NativeToolTransport,
) {
  const home = resolve(root, "home");
  const project = resolve(root, "project");
  await mkdir(home);
  await mkdir(project);
  await writeFile(resolve(project, "source.txt"), Buffer.from("Original project content"));
  const launch =
    backend === Backend.Codex
      ? {
          executable: resolve(vendors, VendorFixture.Codex) + (missing ? ".missing" : ""),
        }
      : {
          executable: resolve(vendors, VendorFixture.Claude) + (missing ? ".missing" : ""),
          runtime: AgentRuntime.Bun,
        };
  const native_tools = transport ? { transport } : undefined;
  const server = {
    max_pending_run_operations: 1,
    max_pending_submissions: 1,
    max_resident_runs: 1,
    backends: { [backend]: launch },
    ...(native_tools ? { native_tools } : {}),
  };
  await writeFile(
    resolve(home, ConfigFile.User),
    Buffer.from(
      JSON.stringify({
        server,
        workspace: { mode: WorkspaceModeSetting.Isolated },
        defaults: { claude_max_turns: 3 },
        recovery: {
          max_retries: allowance,
          base_delay_s: 0.001,
          max_delay_s: 0.002,
          jitter_ratio: 0,
        },
      }),
    ),
  );
  return { home, project };
}

export async function runtimeBackend(backend: BackendId, missing: boolean) {
  return withTemporaryDirectory((root) => runtimeBackendAtRoot(root, backend, missing));
}

async function runtimeBackendAtRoot(root: string, backend: BackendId, missing: boolean) {
  const { home, project } = await prepareSdkProject(root, backend, 1, missing);
  const ready = Promise.withResolvers<void>();
  const stop = Promise.withResolvers<void>();
  const running = serveUntilStopped(
    home,
    () => ready.resolve(),
    () => stop.promise,
  );
  running.catch(ready.reject);
  try {
    await ready.promise;
    const workflow = vendorRecoveryWorkflow();
    for (const checker of workflow.steps.flatMap((step) => step.falsify))
      checker.task = VendorStubMode.Complete;
    const run = RunSchema.parse(
      await call(home, "/runs", "POST", {
        project,
        workflow,
        backend,
        client_id: "runtime",
        submission_id: "backend",
      }),
    );
    const finished = await waitUntil(async () => {
      const state = RunSchema.parse(await call(home, `/runs/${run.run_id}`)).state;
      return state === RunStatus.Passed || state === RunStatus.Blocked;
    }, SdkProcessFixture.ObserveAttempts);
    if (!finished) throw new Error("Runtime backend never settled");
    const state = RunSchema.parse(await call(home, `/runs/${run.run_id}`)).state;
    return { passed: state === RunStatus.Passed, blocked: state === RunStatus.Blocked };
  } finally {
    stop.resolve();
    await running;
  }
}

async function stopSdkChildren(children: readonly ReturnType<typeof spawnServer>[]): Promise<void> {
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGKILL");
    await child.exited;
  }
}
