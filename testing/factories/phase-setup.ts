import { strict as assert } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import { Backend, ExecutionPhase, RunFile, RunStatus } from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { AgentSession, AgentSpec } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { schemaFakeAnswer } from "../support/backend.ts";

class TaskRecordBackend extends FakeBackend {
  constructor() {
    super(schemaFakeAnswer);
    this.opened = 0;
    this.closed = 0;
    this.sent = 0;
  }
  opened: number;
  closed: number;
  sent: number;
  async start(spec: AgentSpec): Promise<AgentSession> {
    this.opened++;
    const session = await super.start(spec);
    return {
      send: async (...args) => {
        this.sent++;
        return session.send(...args);
      },
      cancel: session.cancel,
      close: async () => {
        this.closed++;
        await session.close();
      },
    };
  }
}

export async function phaseSetup(blockedPhase: string | null, count = 1, restart = false) {
  return withTemporaryDirectory(async (project) => {
    const backend = new TaskRecordBackend();
    const factory = () => backend;
    const engine = new Engine(factory);
    const workflow = vendorRecoveryWorkflow();
    const first = workflow.steps[0];
    assert.ok(first);
    workflow.steps = Array.from({ length: count }, (_, index) => ({
      ...first,
      id: index ? `deliver-${index}` : first.id,
    }));
    const run = await engine.create({
      project,
      plan: validateWorkflow(workflow),
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: { recovery: { max_retries: 0 } },
      }),
      backend: Backend.Fake,
      client_id: "phase-setup",
      submission_id: "one",
    });
    const target = resolve(
      run.root,
      RunFile.Steps,
      first.id,
      `${RunFile.AttemptPrefix}1`,
      `${blockedPhase}${RunFile.TaskSuffix}`,
    );
    if (blockedPhase) await mkdir(target, { recursive: true });
    await engine.start(run.run_id);
    const blocked = run.state === RunStatus.Blocked;
    const initialAgents = backend.opened;
    const initialSent = backend.sent;
    const initialExecutions =
      run.nodes[first.id]?.phases[blockedPhase ?? ExecutionPhase.Worker]?.executions;
    assert.equal(backend.closed, backend.opened);
    if (blockedPhase) {
      assert.equal(run.nodes[first.id]?.attempt, 1);
      assert.equal(run.nodes[first.id]?.refutations, 0);
      assert.equal(run.nodes[first.id]?.phases[blockedPhase]?.retries, 0);
      await rm(target, { recursive: true });
      const recovered = restart ? new Engine(factory) : engine;
      if (restart) await recovered.load(run.root);
      await recovered.resume(run.run_id);
      assert.equal((await recovered.snapshot(run.run_id)).state, RunStatus.Passed);
    }
    assert.equal(backend.closed, backend.opened);
    const result =
      restart && blockedPhase
        ? await new Engine(factory).load(run.root)
        : await engine.snapshot(run.run_id);
    assert.ok(
      Object.values(result.nodes).every((node) => node.attempt === 1 && node.refutations === 0),
    );
    return {
      blocked,
      initialAgents,
      initialSent,
      initialExecutions,
      agents: backend.opened,
      closed: backend.closed,
      sent: backend.sent,
      state: result.state,
    };
  });
}
