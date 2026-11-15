import { Database } from "bun:sqlite";
import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  ExecutionPhase,
  RunStatus,
  SnapshotMutation,
  Verdict,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { NativeToolExecutionOwner } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";

export function snapshotReconciliation(mutation: SnapshotMutation, occurrence: number) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    const database = new Database(resolve(project, "state.db"));
    database.exec(
      "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE records(value TEXT); INSERT INTO records VALUES ('Original record')",
    );
    let closed = false;
    let armed = false;
    let observations = 0;
    let workers = 0;
    let reconciliations = 0;
    let checks = 0;
    const nativeTools: NativeToolExecutionOwner = {
      open(scope, current, directory) {
        const connection = nativeBridgeConnection(scope.role, directory);
        connection.scope = scope;
        return {
          binding: { connection, launch: { command: process.execPath, args: [] } },
          async guard() {
            assert.equal(current(), true);
          },
          async close() {},
          scanner: () => ({
            accept(bytes) {
              if (!armed || Buffer.from(bytes).toString() !== "state.db-wal") return;
              observations++;
              if (observations !== occurrence || mutation === SnapshotMutation.None) return;
              armed = false;
              if (mutation === SnapshotMutation.Deleted) {
                database.close();
                closed = true;
              } else database.exec("INSERT INTO records VALUES ('Concurrent record')");
            },
          }),
        };
      },
    };
    const factory = () =>
      new FakeBackend(async (spec, prompt) => {
        const task = JSON.parse(prompt);
        if (!spec.writable) {
          checks++;
          assert.equal(
            await readFile(resolve(project, "worker.txt"), "utf8"),
            mutation === SnapshotMutation.None ? "Received edit" : "External edit",
          );
          return { json: { verdict: Verdict.Survived, evidence: "Checked retained work" } };
        }
        if (task.reconciliation) {
          reconciliations++;
          assert.deepEqual(task.reconciliation.original_result, {
            ok: true,
            marker: "candidate",
            turn: 1,
          });
          assert.equal(task.reconciliation.generation, 1);
          assert.equal(
            await readFile(resolve(task.reconciliation.current_input, "worker.txt"), "utf8"),
            "External edit",
          );
        } else {
          workers++;
          await writeFile(resolve(project, "worker.txt"), "Received edit");
          armed = true;
        }
        return {
          json: { ok: true, marker: "candidate", turn: 1 },
          usage: { input_tokens: 5, output_tokens: 2, cost_usd: 0.01 },
        };
      });
    try {
      const workflow = vendorRecoveryWorkflow();
      workflow.personas.worker.tools = [AgentTool.Read, AgentTool.Write];
      let engine = new Engine(factory, {}, { nativeTools });
      const run = await engine.create({
        project,
        plan: validateWorkflow(workflow),
        config: await resolveConfig({ home: resolve(root, "home"), project }),
        backend: Backend.Fake,
        client_id: "snapshot-reconciliation",
        submission_id: `${mutation}-${occurrence}`,
      });
      await engine.start(run.run_id);
      const first = await engine.snapshot(run.run_id);
      assert.equal(workers, 1);
      assert.ok(observations >= occurrence);
      if (mutation === SnapshotMutation.None) {
        assert.equal(first.state, RunStatus.Passed);
        assert.equal(checks, 1);
        assert.equal(reconciliations, 0);
        return true;
      }
      assert.equal(first.state, RunStatus.Blocked);
      assert.equal(checks, 0);
      const received = first.nodes.deliver?.phases[ExecutionPhase.Worker];
      assert.ok(received?.capture_pending);
      assert.equal(received.executions, 1);
      assert.equal(received.usage.length, 1);
      assert.equal((await engine.usage(run.run_id)).executions, 1);
      if (!closed) {
        database.close();
        closed = true;
      }
      await writeFile(resolve(project, "worker.txt"), "External edit");
      engine = new Engine(factory, {}, { nativeTools });
      await engine.load(run.root);
      await engine.resume(run.run_id);
      const recovered = await engine.snapshot(run.run_id);
      assert.equal(recovered.state, RunStatus.Passed);
      assert.equal(workers, 1);
      assert.equal(reconciliations, 1);
      assert.equal(checks, 1);
      assert.equal(recovered.nodes.deliver?.attempt, 1);
      assert.deepEqual(
        recovered.nodes.deliver?.reconciliations?.[0]?.phases[ExecutionPhase.Worker],
        received,
      );
      assert.equal((await engine.usage(run.run_id)).executions, 3);
      assert.equal(await readFile(resolve(project, "worker.txt"), "utf8"), "External edit");
      const inspect = new Database(resolve(project, "state.db"), { readonly: true });
      try {
        assert.deepEqual(inspect.query("SELECT value FROM records").all(), [
          { value: "Original record" },
          ...(mutation === SnapshotMutation.Deleted ? [] : [{ value: "Concurrent record" }]),
        ]);
      } finally {
        inspect.close();
      }
      return true;
    } finally {
      if (!closed) database.close();
    }
  });
}
