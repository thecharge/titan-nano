import { strict as assert } from "node:assert";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  ExecutionPhase,
  IoLimit,
  RunEventKind,
  RunStatus,
  StepStatus,
  Verdict,
  WorkspaceModeSetting,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ObjectSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { isolatedWorkspace } from "../support/isolated.ts";

export function attemptInputRecovery(
  checker: boolean,
  dependency: boolean,
  changed: boolean,
  missing = false,
) {
  return withTemporaryDirectory((project) =>
    observeAttemptInput(project, checker, dependency, changed, missing),
  );
}

async function observeAttemptInput(
  project: string,
  checker: boolean,
  dependency: boolean,
  changed: boolean,
  missing: boolean,
) {
  await writeFile(resolve(project, "source.txt"), Buffer.from("Original input"));
  const key = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
  const calls = { target: 0, parent: 0 };
  let interrupted = false;
  const worker = { ok: true, marker: "candidate", turn: 1 };
  const reviewed = { verdict: Verdict.Survived, evidence: "Independent review" };
  const backend = new FakeBackend(async (spec) => {
    if (spec.invocation_id.startsWith("parent/")) {
      calls.parent++;
      if (spec.writable)
        await writeFile(resolve(spec.cwd, "parent.txt"), Buffer.from("Parent input"));
      return { json: spec.writable ? worker : reviewed };
    }
    calls.target++;
    if (spec.invocation_id === `deliver/1/${key}` && !interrupted) {
      interrupted = true;
      throw new OperationalError(ErrorCode.CodexExecution, "Controlled interruption");
    }
    return { json: spec.writable ? worker : reviewed };
  });
  const factory = () => backend;
  let engine = new Engine(factory);
  const base = vendorRecoveryWorkflow("Review input checkpoint");
  const step = base.steps[0];
  assert.ok(step);
  const steps = dependency ? [{ ...step, id: "parent" }, step] : [step];
  const overrides = {
    workspace: { mode: WorkspaceModeSetting.Isolated },
    recovery: { max_retries: 1 },
  };
  const config = await resolveConfig({
    home: resolve(project, "home"),
    project,
    overrides: { ...isolatedWorkspace, ...overrides },
  });
  const run = await engine.create({
    project,
    config,
    plan: validateWorkflow({ ...base, steps }),
    backend: Backend.Fake,
    client_id: "input-checkpoint",
    submission_id: "one",
  });
  await engine.start(run.run_id);
  const initial = await engine.snapshot(run.run_id);
  assert.equal(initial.state, RunStatus.Blocked);
  const node = initial.nodes.deliver;
  assert.ok(node?.input && node.phases[key]);
  assert.equal(node.phases[ExecutionPhase.Worker]?.completed, checker);
  const source = resolve(node.input, dependency ? "parent.txt" : "source.txt");
  const original = await readFileBytes(source, IoLimit.DataBytes);
  const before = { ...calls };
  if (missing) await rm(node.input, { recursive: true });
  else if (changed) await writeFile(source, Buffer.from("Changed checkpoint input"));
  engine = new Engine(factory);
  await engine.load(run.root);
  await engine.resume(run.run_id);
  const final = await engine.snapshot(run.run_id);
  const delivered = final.nodes.deliver;
  assert.ok(delivered);
  assert.equal(delivered.attempt, 1);
  assert.equal(delivered.refutations, 0);
  assert.deepEqual(delivered.evidence, []);
  if (dependency) {
    assert.equal(final.nodes.parent?.state, StepStatus.Passed);
    assert.equal(calls.parent, 2);
  }
  if (changed) {
    assert.equal(final.state, RunStatus.Blocked);
    assert.equal(final.artifacts, null);
    assert.deepEqual(calls, before);
    assert.deepEqual(delivered.phases, node.phases);
    const events = await engine.events(run.run_id);
    assert.ok(
      events.events.some(
        (event) =>
          event.id > initial.version &&
          event.type === RunEventKind.StepBlocked &&
          ObjectSchema.parse(event.data).error ===
            (missing ? "deliver" : RunnerMessage.InputCheckpoint),
      ),
    );
    return true;
  }
  assert.equal(final.state, RunStatus.Passed);
  assert.equal(calls.target, 3);
  assert.deepEqual(await readFileBytes(source, IoLimit.DataBytes), original);
  return true;
}

export function attemptInputPublication(checker: boolean, changed: boolean) {
  return withTemporaryDirectory(async (project) => {
    await writeFile(resolve(project, "source.txt"), Buffer.from("Original input"));
    let calls = 0;
    const backend = new FakeBackend(async (spec) => {
      calls++;
      if (changed && spec.writable !== checker)
        await writeFile(resolve(spec.cwd, "../input/source.txt"), Buffer.from("Changed input"));
      const worker = { ok: true, marker: "candidate", turn: 1 };
      const reviewed = { verdict: Verdict.Survived, evidence: "Independent review" };
      return { json: spec.writable ? worker : reviewed };
    });
    const engine = new Engine(() => backend);
    const config = await resolveConfig({
      home: resolve(project, "home"),
      project,
      overrides: isolatedWorkspace,
    });
    const run = await engine.create({
      project,
      config,
      plan: validateWorkflow(vendorRecoveryWorkflow("Review publication input")),
      backend: Backend.Fake,
      client_id: "input-publication",
      submission_id: "one",
    });
    await engine.start(run.run_id);
    const final = await engine.snapshot(run.run_id);
    const node = final.nodes.deliver;
    assert.ok(node);
    assert.equal(final.state, changed ? RunStatus.Blocked : RunStatus.Passed);
    assert.equal(node.attempt, 1);
    assert.equal(node.refutations, 0);
    assert.deepEqual(node.evidence, []);
    assert.equal(calls, 2);
    assert.equal(node.phases[ExecutionPhase.Worker]?.completed, true);
    assert.equal(node.phases[`${ExecutionPhase.FalsifierPrefix}0`]?.completed, true);
    if (changed) assert.equal(final.artifacts, null);
    else assert.ok(final.artifacts);
    return true;
  });
}
