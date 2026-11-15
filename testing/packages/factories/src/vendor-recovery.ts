import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  ExecutionPhase,
  FileEncoding,
  IoLimit,
  RunEventKind,
  RunStatus,
  VendorStubMode,
} from "@titan/constants";
import { all } from "@titan/core";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import type { BackendFactory, BackendId } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function observeVendorRecovery(
  factory: BackendFactory,
  backend: BackendId,
  root: string,
  restart: boolean,
  allowance: number,
  task: string = VendorStubMode.RecoverOnce,
) {
  const project = join(root, "project");
  const home = join(root, "home");
  await all([() => mkdir(project), () => mkdir(home)]);
  await writeFile(join(project, "source.txt"), Buffer.from("Original project content"));
  const overrides = {
    defaults: { claude_max_turns: 3 },
    recovery: {
      max_retries: allowance,
      base_delay_s: 0.001,
      max_delay_s: 0.002,
      jitter_ratio: 0,
    },
  };
  const config = await resolveConfig({ home, project, overrides });
  const plan = validateWorkflow(vendorRecoveryWorkflow(task));
  const engine = new Engine(factory);
  const run = await engine.create({
    project,
    plan,
    config,
    backend,
    client_id: "contract",
    submission_id: "recovery",
  });
  await engine.start(run.run_id);
  const initialBlocked = run.state === RunStatus.Blocked;
  assert.deepEqual(run.nodes.deliver?.evidence, []);
  const session = run.nodes.deliver?.phases[`${ExecutionPhase.FalsifierPrefix}0`]?.session_id;
  const checkpoint = join(run.root, "steps/deliver/attempt-1/candidate.hash");
  const before = (await readFileBytes(checkpoint, IoLimit.HashBytes)).toString(FileEncoding.Utf8);
  const recovered = restart ? new Engine(factory) : engine;
  const restored = restart ? await recovered.load(run.root) : run;
  await recovered.resume(run.run_id);
  const node = restored.nodes.deliver;
  assert.deepEqual(node?.evidence, []);
  const worker = node?.phases[ExecutionPhase.Worker];
  const checker = node?.phases[`${ExecutionPhase.FalsifierPrefix}0`];
  const events = await recovered.events(run.run_id);
  return {
    initialBlocked,
    passed: restored.state === RunStatus.Passed,
    attempt: node?.attempt,
    refutations: node?.refutations,
    workerExecutions: worker?.executions,
    checkerExecutions: checker?.executions,
    sessionPreserved: Boolean(session) && session === checker?.session_id,
    checkpointPreserved:
      before === (await readFileBytes(checkpoint, IoLimit.HashBytes)).toString(FileEncoding.Utf8),
    artifactPublished: restored.artifacts !== null,
    deliveredFile:
      restored.artifacts !== null &&
      (await readFileBytes(join(restored.artifacts, "DELIVERED.txt"), IoLimit.DataBytes)).toString(
        FileEncoding.Utf8,
      ) === "Delivered by SDK stub",
    originalPreserved:
      (await readFileBytes(join(project, "source.txt"), IoLimit.DataBytes)).toString(
        FileEncoding.Utf8,
      ) === "Original project content",
    failureRecorded: events.events.some((event) => event.type === RunEventKind.ExecutionBlocked),
  };
}

export function vendorRecoveryWorkflow(task: string = VendorStubMode.RecoverOnce) {
  const outputs = {
    ok: { type: "boolean" },
    marker: { type: "string" },
    turn: { type: "integer" },
  };
  const worker = {
    description: "Worker",
    role: "Transport contract role",
    model: "stub-model",
    tools: [AgentTool.Read, AgentTool.Write],
    outputs,
  };
  const checker = {
    description: "Checker",
    role: "Transport contract role",
    model: "stub-model",
    tools: [AgentTool.Read],
  };
  const step = {
    id: "deliver",
    do: { persona: "worker", task: "complete" },
    falsify: [{ persona: "checker", task }],
  };
  return {
    name: "SDK recovery",
    goal: "Keep completed work through an interrupted check",
    personas: { worker, checker },
    steps: [step],
  };
}
