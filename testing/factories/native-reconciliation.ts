import { strict as assert } from "node:assert";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  BoardFile,
  ConfigFile,
  ExecutionPhase,
  RequestDecision,
  RunAction,
  RunEventKind,
  RunFormat,
  RunStatus,
  SdkProcessFixture,
  VendorStubMode,
  WorkspaceModeSetting,
} from "@titan/constants";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ConfigSchema,
  type NativeBackendId,
  RunEventSchema,
  RunSchema,
  type SdkProbePaths,
} from "@titan/types";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function nativeReconciliation(
  backend: NativeBackendId,
  allowance: number,
  sealed = false,
  completed = false,
  paths: SdkProbePaths = {},
  script = false,
  split = false,
) {
  return withTemporaryDirectory(async (root) => {
    const { home, project } = await prepareSdkProject(
      root,
      backend,
      allowance,
      false,
      paths.vendors,
    );
    const configuration = resolve(home, ConfigFile.User);
    const config = ConfigSchema.parse(JSON.parse(await readFile(configuration, "utf8")));
    config.workspace = { ...config.workspace, mode: WorkspaceModeSetting.Live };
    await writeFile(configuration, JSON.stringify(config));
    let child = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    try {
      assert.equal(
        await waitUntil(() => serverReady(home, child.pid), SdkProcessFixture.ObserveAttempts),
        true,
      );
      const client = createRunClient(home);
      const workflow = vendorRecoveryWorkflow();
      const step = workflow.steps[0];
      assert.ok(step);
      step.do.task = split ? "split_received" : sealed ? "sealed_received" : "capture_received";
      for (const checker of step.falsify) checker.task = VendorStubMode.Complete;
      const run = await client.submit({
        project,
        workflow: split
          ? {
              ...workflow,
              personas: {
                ...workflow.personas,
                source: {
                  ...workflow.personas.worker,
                  outputs: {
                    ...workflow.personas.worker.outputs,
                    parts: { type: "array", items: { type: "integer" } },
                  },
                },
              },
              steps: [
                { ...step, id: "source", do: { persona: "source", task: "split_source" } },
                {
                  ...step,
                  split: { parts: "source.parts", width: 1 },
                  reconcile: { ...step.do, task: "Merge retained split files" },
                },
              ],
            }
          : script
            ? {
                ...workflow,
                steps: [
                  {
                    ...step,
                    do: {
                      script:
                        "mkdir -p .titan/vendor-fixture; printf 'original\\n' >> .titan/vendor-fixture/original-calls.jsonl; printf 'Received worker edit' > source.txt; ln -s source.txt unsafe-link; printf 'Script result'",
                    },
                    reconcile: { ...step.do, task: "Merge retained script files" },
                  },
                ],
              }
            : workflow,
        backend,
        client_id: "native-reconciliation",
        submission_id: "received",
      });
      if (script) {
        assert.ok(
          await waitUntil(
            async () => (await client.get(run.run_id)).state === RunStatus.Waiting,
            SdkProcessFixture.ObserveAttempts,
          ),
        );
        const requests = createRequestClient(home);
        const pending = (await requests.list({ run_id: run.run_id })).requests.find(
          (entry) => entry.request.answer === null,
        )?.request;
        assert.ok(pending);
        await assert.rejects(
          readFile(resolve(project, ".titan/vendor-fixture/original-calls.jsonl")),
          { code: "ENOENT" },
        );
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: pending.request_id,
            version: pending.version,
            decision: RequestDecision.Approve,
            reason: "Reviewed exact script and project",
            client_id: "owner",
          },
          ApprovalLevel.Human,
        );
      }
      assert.equal(
        await waitUntil(
          async () =>
            (await client.get(run.run_id)).state ===
            (sealed ? RunStatus.Passed : RunStatus.Blocked),
          SdkProcessFixture.ObserveAttempts,
        ),
        true,
      );
      let original = RunSchema.parse(await client.get(run.run_id)).nodes.deliver?.phases[
        ExecutionPhase.Worker
      ];
      child.kill("SIGTERM");
      await child.exited;
      if (sealed) {
        const journal = resolve(run.root, BoardFile.Journal);
        const lines = (await readFile(journal, "utf8")).trimEnd().split("\n");
        const index = lines.findIndex((line) => {
          const event = RunEventSchema.parse(JSON.parse(line));
          const worker = event.state.nodes.deliver?.phases[ExecutionPhase.Worker];
          return completed
            ? event.type === RunEventKind.PhaseCompleted &&
                worker?.completed &&
                worker.candidate_hash
            : event.type === RunEventKind.PhaseCaptured && worker?.capture_pending;
        });
        assert.ok(index >= 0);
        original = RunEventSchema.parse(JSON.parse(lines[index] ?? "")).state.nodes.deliver?.phases[
          ExecutionPhase.Worker
        ];
        await writeFile(journal, `${lines.slice(0, index + 1).join("\n")}\n`);
      }
      assert.ok(original);
      assert.ok(
        completed ? original.completed && original.candidate_hash : original.capture_pending,
      );
      assert.equal(original.executions, script || split ? 0 : 1);
      if (!sealed) await rm(resolve(project, "unsafe-link"));
      await writeFile(resolve(project, "source.txt"), "External edit");
      child = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
      assert.equal(
        await waitUntil(() => serverReady(home, child.pid), SdkProcessFixture.ObserveAttempts),
        true,
      );
      await client.control(run.run_id, RunAction.Resume);
      assert.equal(
        await waitUntil(async () => {
          const observed = await client.get(run.run_id);
          return observed.state === RunStatus.Passed || observed.state === RunStatus.Blocked;
        }, SdkProcessFixture.ObserveAttempts),
        true,
      );
      const final = RunSchema.parse(await client.get(run.run_id));
      const node = final.nodes.deliver;
      assert.ok(node);
      assert.equal(
        final.state,
        allowance ? RunStatus.Passed : RunStatus.Blocked,
        final.error ?? final.state,
      );
      assert.equal(node.attempt, 1);
      assert.equal(node.refutations, 0);
      assert.equal(await readFile(resolve(project, "source.txt"), "utf8"), "External edit");
      assert.equal(
        await readFile(resolve(project, ".titan/vendor-fixture/original-calls.jsonl"), "utf8"),
        split ? "original\noriginal\n" : "original\n",
      );
      assert.equal(
        (await client.usage(run.run_id)).executions,
        (allowance ? 3 : 1) - (script ? 1 : 0) + (split ? 3 : 0),
      );
      if (allowance) {
        assert.equal(
          final.schema_version,
          final.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
        );
        assert.deepEqual(node.reconciliations?.[0]?.phases[ExecutionPhase.Worker], original);
        assert.equal(node.phases[ExecutionPhase.Worker]?.executions, 1);
        assert.equal(node.phases[`${ExecutionPhase.FalsifierPrefix}0`]?.executions, 1);
        const calls = (
          await readFile(
            resolve(project, ".titan/vendor-fixture/reconciliation-calls.jsonl"),
            "utf8",
          )
        )
          .trimEnd()
          .split("\n");
        assert.equal(calls.length, 1);
        if (split) {
          assert.ok(Array.isArray(node.output));
          assert.equal(node.output.length, 2);
          assert.equal(
            node.reconciliations?.[0]?.phases[`${ExecutionPhase.PartPrefix}0`]?.executions,
            1,
          );
          assert.equal(
            node.reconciliations?.[0]?.phases[`${ExecutionPhase.PartPrefix}1`]?.executions,
            1,
          );
        }
        if (script)
          assert.deepEqual(node.output, { exit_code: 0, stdout: "Script result", stderr: "" });
      } else {
        assert.equal(node.reconciliations, undefined);
        assert.deepEqual(node.phases[ExecutionPhase.Worker], original);
        await assert.rejects(
          readFile(resolve(project, ".titan/vendor-fixture/reconciliation-calls.jsonl")),
          { code: "ENOENT" },
        );
      }
      return true;
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await child.exited;
    }
  });
}

export function nativeScriptReconciliation(
  backend: NativeBackendId,
  allowance: number,
  paths: SdkProbePaths = {},
) {
  return nativeReconciliation(backend, allowance, false, false, paths, true);
}

export function nativeSplitReconciliation(
  backend: NativeBackendId,
  allowance: number,
  paths: SdkProbePaths = {},
) {
  return nativeReconciliation(backend, allowance, false, false, paths, false, true);
}
