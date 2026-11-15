import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import { Backend, ExecutionPhase, IoLimit, RunStatus, StepStatus } from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { AgentSpec, FakeHandler } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

class TaskInputBackend extends FakeBackend {
  opened: number;
  constructor(handler: FakeHandler) {
    super(handler);
    this.opened = 0;
  }
  async start(spec: AgentSpec) {
    this.opened++;
    return super.start(spec);
  }
}

export async function taskInput(references: number, key: string = ExecutionPhase.Worker) {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const first = workflow.steps[0];
    assert.ok(first);
    const plan = validateWorkflow({
      ...workflow,
      steps: [
        first,
        {
          ...first,
          id: "consume",
          inputs: Object.fromEntries(
            Array.from({ length: references }, (_, index) => [`input-${index}`, "deliver.marker"]),
          ),
        },
      ],
    });
    let turns = 0;
    const backend = new TaskInputBackend(async (spec) => {
      turns++;
      return {
        json: spec.writable
          ? { ok: true, marker: "x".repeat(IoLimit.DataBytes / 8), turn: 1 }
          : { verdict: "survived", evidence: "Checked" },
      };
    });
    const factory = () => backend;
    const engine = new Engine(factory);
    const run = await engine.create({
      project,
      plan,
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: { recovery: { max_retries: 0 } },
      }),
      backend: Backend.Fake,
      client_id: "task-input",
      submission_id: "one",
    });
    await engine.start(run.run_id);
    const phase = run.nodes.consume?.phases[key];
    assert.ok(phase);
    assert.equal(run.nodes.deliver?.attempt, 1);
    assert.equal(run.nodes.deliver?.state, StepStatus.Passed);
    assert.equal(run.nodes.consume?.attempt, 1);
    assert.equal(run.nodes.consume?.refutations, 0);
    assert.equal(phase.retries, 0);
    if (run.state === RunStatus.Blocked) {
      const recovered = new Engine(factory);
      await recovered.load(run.root);
      await recovered.resume(run.run_id);
      assert.equal((await recovered.snapshot(run.run_id)).state, RunStatus.Blocked);
      const expected = key === ExecutionPhase.Worker ? 2 : 3;
      assert.equal(backend.opened, expected);
      assert.equal(turns, expected);
    }
    return { state: run.state, opened: backend.opened, turns, executions: phase.executions };
  });
}
