import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { resolveConfig } from "@titan/config";
import { AgentHost, AgentRuntime, Backend, ExecutionPhase, RunStatus } from "@titan/constants";
import { Engine } from "@titan/runner";
import { HostedBackend } from "@titan/runtime";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { AgentSpec, NativeBackendId } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

class ObservedHostBackend extends HostedBackend {
  opened: number;
  constructor(id: NativeBackendId) {
    super(id, {
      executable: resolve(
        "testing/fixtures/vendors",
        id === Backend.Codex ? "codex-0.171.0.mjs" : "claude-0.3.329.mjs",
      ),
      ...(id === Backend.Claude ? { runtime: AgentRuntime.Bun } : {}),
    });
    this.opened = 0;
  }
  async start(spec: AgentSpec) {
    this.opened++;
    return super.start(spec);
  }
}

export async function hostTask(id: NativeBackendId, oversized: boolean) {
  return withTemporaryDirectory(async (project) => {
    const backend = new ObservedHostBackend(id);
    const factory = () => backend;
    const engine = new Engine(factory);
    const workflow = vendorRecoveryWorkflow("complete");
    if (oversized) workflow.personas.worker.role += "x".repeat(AgentHost.MessageBytes);
    const run = await engine.create({
      project,
      plan: validateWorkflow(workflow),
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: { defaults: { claude_max_turns: 3 }, recovery: { max_retries: 0 } },
      }),
      backend: id,
      client_id: "host-task",
      submission_id: "one",
    });
    await engine.start(run.run_id);
    const phase = run.nodes.deliver?.phases[ExecutionPhase.Worker];
    assert.ok(phase);
    assert.equal(run.nodes.deliver?.attempt, 1);
    assert.equal(run.nodes.deliver?.refutations, 0);
    assert.equal(phase.retries, 0);
    if (oversized) {
      const recovered = new Engine(factory);
      await recovered.load(run.root);
      await recovered.resume(run.run_id);
      assert.equal((await recovered.snapshot(run.run_id)).state, RunStatus.Blocked);
      assert.equal(backend.opened, 0);
      assert.equal(phase.executions, 0);
    }
    return { state: run.state, opened: backend.opened, executions: phase.executions };
  });
}
