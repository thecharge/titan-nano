import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  Backend,
  ExecutionPhase,
  RequestDecision,
  RunAction,
  RunEventKind,
  RunStatus,
  SdkDelivery,
  StepStatus,
} from "@titan/constants";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSchema, type SdkProbePaths, WorkflowSchema } from "@titan/types";
import { duplicateRequestContinuation } from "../support/request-continuation.ts";
import { projectionMatches } from "../support/request-projection.ts";
import { preparePlanProject } from "./sdk-plan.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function requestTurnParallel(
  checker: boolean,
  pending: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory(async (root) => {
    const { home, project } = await preparePlanProject(
      root,
      paths.vendors ?? resolve("testing/fixtures/vendors"),
    );
    const children: ReturnType<typeof spawnServer>[] = [];
    const key = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
    try {
      const first = spawnServer(home, paths.cli, SdkDelivery.DaemonTimeout);
      children.push(first);
      assert.ok(await waitUntil(() => serverReady(home, first.pid)));
      const base = vendorRecoveryWorkflow("complete");
      const target = base.steps[0];
      assert.ok(target);
      const workflow = WorkflowSchema.parse({
        ...base,
        steps: undefined,
        personas: {
          codex: { ...base.personas.worker, backend: Backend.Codex, request_turns: true },
          claude: { ...base.personas.worker, backend: Backend.Claude, request_turns: true },
          codexCheck: { ...base.personas.checker, backend: Backend.Codex, request_turns: true },
          claudeCheck: { ...base.personas.checker, backend: Backend.Claude, request_turns: true },
        },
        graph: {
          nodes: ["seed", "left", "right", "join"].map((id) => {
            const asking = id === "left" || id === "right";
            const codex = id !== "right";
            return {
              ...target,
              id,
              needs: id === "seed" ? [] : id === "join" ? ["left", "right"] : ["seed"],
              do: {
                persona: codex ? "codex" : "claude",
                task: asking && !checker ? "request_turn" : "complete",
              },
              falsify: [
                {
                  persona: codex ? "codexCheck" : "claudeCheck",
                  task: asking && checker ? "request_turn" : "complete",
                },
              ],
            };
          }),
        },
        limits: { max_parallel: 2 },
      });
      const runs = createRunClient(home);
      const requests = createRequestClient(home);
      const run = await runs.submit({
        project,
        workflow,
        backend: Backend.Codex,
        client_id: "parallel-turns",
        submission_id: "parallel-turns",
      });
      assert.ok(
        await waitUntil(
          async () => (await runs.get(run.run_id)).state === RunStatus.Waiting,
          SdkDelivery.SettleAttempts,
          SdkDelivery.PollMilliseconds,
        ),
      );
      const waiting = RunSchema.parse(await runs.get(run.run_id));
      assert.equal(waiting.nodes.seed?.state, StepStatus.Passed);
      assert.equal(waiting.nodes.join?.state, StepStatus.Pending);
      assert.equal(waiting.nodes.left?.state, StepStatus.Waiting);
      assert.equal(waiting.nodes.right?.state, StepStatus.Waiting);
      const page = await requests.list({ run_id: run.run_id });
      assert.equal(page.requests.length, 2);
      await projectionMatches(
        waiting,
        page.requests.map((entry) => entry.request),
      );
      assert.equal(
        new Set(page.requests.map(({ request }) => request.origin.harness_session_id)).size,
        2,
      );
      if (pending) {
        await runs.control(run.run_id, RunAction.Resume);
        assert.ok(
          await waitUntil(
            async () => (await runs.get(run.run_id)).state === RunStatus.Waiting,
            SdkDelivery.SettleAttempts,
            SdkDelivery.PollMilliseconds,
          ),
        );
        const retained = RunSchema.parse(await runs.get(run.run_id));
        assert.equal(retained.nodes.left?.phases[key]?.executions, 1);
        assert.equal(retained.nodes.right?.phases[key]?.executions, 1);
        assert.deepEqual(await requests.list({ run_id: run.run_id }), page);
      }
      const order = checker ? ["right", "left"] : ["left", "right"];
      for (const [index, id] of order.entries()) {
        const request = page.requests.find(
          (item) => item.request.origin.execution?.step_id === id,
        )?.request;
        assert.ok(request);
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: request.request_id,
            version: request.version,
            client_id: "parallel-reviewer",
            reason: "Reviewed request turn",
            decision: index === 0 ? RequestDecision.Deny : RequestDecision.Approve,
          },
          ApprovalLevel.Main,
        );
        await duplicateRequestContinuation(
          waiting,
          id,
          key,
          home,
          paths.cli ?? resolve("apps/cli/src/main.ts"),
          id === "right" ? Backend.Claude : Backend.Codex,
        );
        const expected = index === 0 ? RunStatus.Waiting : RunStatus.Passed;
        assert.ok(
          await waitUntil(
            async () => (await runs.get(run.run_id)).state === expected,
            SdkDelivery.SettleAttempts,
            SdkDelivery.PollMilliseconds,
          ),
        );
        const settled = RunSchema.parse(await runs.get(run.run_id));
        assert.equal(settled.nodes[id]?.state, StepStatus.Passed);
        assert.equal(
          settled.nodes[id]?.phases[key]?.session_id,
          waiting.nodes[id]?.phases[key]?.session_id,
        );
        assert.equal(settled.nodes[id]?.phases[key]?.executions, 2);
        assert.equal(settled.nodes[id]?.phases[key]?.retries, 0);
        assert.equal(settled.nodes[id]?.attempt, 1);
        assert.deepEqual(settled.nodes[id]?.evidence, []);
        await projectionMatches(
          settled,
          page.requests
            .filter((entry) => index === 0 && entry.request.origin.execution?.step_id === order[1])
            .map((entry) => entry.request),
        );
        if (index === 0) {
          const other = order[1];
          assert.ok(other);
          assert.equal(settled.nodes[other]?.state, StepStatus.Waiting);
          assert.equal(settled.nodes[other]?.phases[key]?.executions, 1);
          assert.equal(settled.nodes.join?.state, StepStatus.Pending);
          first.kill("SIGKILL");
          await first.exited;
          const second = spawnServer(home, paths.cli, SdkDelivery.DaemonTimeout);
          children.push(second);
          assert.ok(await waitUntil(() => serverReady(home, second.pid)));
          assert.deepEqual(await runs.get(run.run_id), settled);
        }
      }
      const completed = RunSchema.parse(await runs.get(run.run_id));
      const usage = await runs.usage(run.run_id);
      assert.equal(usage.executions, 10);
      assert.equal(usage.reported_executions, 10);
      assert.equal(usage.unreported_executions, 0);
      assert.deepEqual(usage.known, { input_tokens: 40, output_tokens: 20, cost_usd: 0 });
      assert.deepEqual(usage.complete, {
        input_tokens: true,
        output_tokens: true,
        cost_usd: false,
      });
      for (const id of ["seed", "left", "right", "join"]) {
        assert.equal(completed.nodes[id]?.state, StepStatus.Passed);
        assert.equal(
          completed.nodes[id]?.phases[ExecutionPhase.Worker]?.executions,
          !checker && (id === "left" || id === "right") ? 2 : 1,
        );
      }
      const events = await runs.events(run.run_id);
      assert.equal(
        events.events.filter((event) => event.type === RunEventKind.RequestTurnOpened).length,
        2,
      );
      assert.ok(completed.artifacts);
      assert.equal(
        await readFile(resolve(completed.artifacts, "DELIVERED.txt"), "utf8"),
        "Delivered by SDK stub",
      );
      assert.equal(
        await readFile(resolve(project, "source.txt"), "utf8"),
        "Original project content",
      );
      return true;
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill("SIGKILL");
        await child.exited;
      }
    }
  });
}
