import { strict as assert } from "node:assert";
import { chmod, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { initialPhase } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardFile,
  BoardLimit,
  ErrorCode,
  ExecutionPhase,
  Newline,
  PathPart,
  RunFile,
  RunStatus,
  StepStatus,
  Verdict,
  WorkspaceMode,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type NodeState, PhaseSchema, type Run, RunEventSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { readTree, treeHash } from "@titan/workspace";
import { isolatedWorkspace } from "../support/isolated.ts";

export async function replaceCandidate(run: Run, step: string, sidecar = true): Promise<void> {
  const candidate = resolve(
    run.root,
    RunFile.Steps,
    step,
    `${RunFile.AttemptPrefix}1`,
    RunFile.Candidate,
  );
  await writeFile(resolve(candidate, "source.txt"), Buffer.from("Replacement candidate"));
  if (!sidecar) return;
  await writeFile(
    resolve(candidate, PathPart.Parent, RunFile.CandidateHash),
    Buffer.from(await treeHash(await readTree(candidate, run.config.value.limits))),
  );
}

export function candidateCommitmentRecovery(parent: boolean, changed: boolean, legacy = false) {
  return withTemporaryDirectory((project) =>
    observeCandidateCommitment(project, parent, changed, legacy),
  );
}

async function observeCandidateCommitment(
  project: string,
  parent: boolean,
  changed: boolean,
  legacy: boolean,
) {
  await writeFile(resolve(project, "source.txt"), Buffer.from("Original input"));
  let interrupted = false;
  let calls = 0;
  const backend = new FakeBackend(async (spec) => {
    calls++;
    const key = parent ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
    if (spec.invocation_id === `deliver/1/${key}` && !interrupted) {
      interrupted = true;
      throw new OperationalError(ErrorCode.CodexExecution, "Controlled interruption");
    }
    const worker = { ok: true, marker: "candidate", turn: 1 };
    const review = { verdict: Verdict.Survived, evidence: "Independent review" };
    return { json: spec.writable ? worker : review };
  });
  const factory = () => backend;
  let engine = new Engine(factory);
  const workflow = vendorRecoveryWorkflow("Review candidate commitment");
  const step = workflow.steps[0];
  assert.ok(step);
  const overrides = { recovery: { max_retries: 1 } };
  const steps = parent ? [{ ...step, id: "parent" }, step] : [step];
  const config = await resolveConfig({
    home: resolve(project, "home"),
    project,
    overrides: { ...isolatedWorkspace, ...overrides },
  });
  const run = await engine.create({
    project,
    config,
    plan: validateWorkflow({ ...workflow, steps }),
    backend: Backend.Fake,
    client_id: "candidate-commitment",
    submission_id: "restart",
  });
  await engine.start(run.run_id);
  const before = await engine.snapshot(run.run_id);
  assert.equal(before.state, RunStatus.Blocked);
  const node = before.nodes.deliver;
  assert.ok(node);
  if (parent) assert.equal(before.nodes.parent?.state, StepStatus.Passed);
  else assert.equal(node.phases[ExecutionPhase.Worker]?.completed, true);
  const initialCalls = calls;
  if (legacy) await removeCandidateCommitments(before);
  if (changed) await replaceCandidate(before, parent ? "parent" : "deliver", !legacy);
  engine = new Engine(factory);
  await engine.load(run.root);
  await engine.resume(run.run_id);
  const after = await engine.snapshot(run.run_id);
  const delivered = after.nodes.deliver;
  assert.ok(delivered);
  assert.equal(delivered.attempt, 1);
  assert.equal(delivered.refutations, 0);
  assert.deepEqual(delivered.evidence, []);
  if (changed) {
    assert.equal(after.state, RunStatus.Blocked);
    assert.equal(after.artifacts, null);
    assert.equal(calls, initialCalls);
    if (parent) assert.deepEqual(delivered.phases, node.phases);
    else assertCandidatePhases(node, delivered);
    return true;
  }
  assert.equal(after.state, RunStatus.Passed);
  assert.equal(calls, initialCalls + (parent ? 2 : 1));
  return true;
}

async function removeCandidateCommitments(run: Run): Promise<void> {
  removeCandidateHashes(run);
  const path = resolve(run.root, BoardFile.Journal);
  const records = (await readFileBytes(path, BoardLimit.RecordBytes))
    .toString()
    .trim()
    .split(Newline);
  const lines: string[] = [];
  for (const line of records) {
    const event = RunEventSchema.parse(JSON.parse(line));
    removeCandidateHashes(event.state);
    lines.push(JSON.stringify(event));
  }
  await writeFile(path, Buffer.from(lines.join(Newline) + Newline));
}

function removeCandidateHashes(run: Run): void {
  const phases = Object.values(run.nodes).flatMap((node) => Object.values(node.phases));
  for (const phase of phases) Reflect.deleteProperty(phase, "candidate_hash");
}

export function candidateCommitmentPhase(value: unknown): boolean {
  return PhaseSchema.safeParse(
    value === undefined ? initialPhase() : { ...initialPhase(), candidate_hash: value },
  ).success;
}

export function assertCandidatePhases(before: NodeState, after: NodeState): void {
  assert.deepEqual(after.phases[ExecutionPhase.Worker], before.phases[ExecutionPhase.Worker]);
  const key = `${ExecutionPhase.FalsifierPrefix}0`;
  assert.deepEqual(after.phases[key], { ...before.phases[key], error: after.phases[key]?.error });
  assert.equal(after.phases[key]?.error, before.phases[key]?.error);
}

export function candidateCommitmentPublication(executable: boolean, changed: boolean) {
  return withTemporaryDirectory(async (project) => {
    await writeFile(resolve(project, "source.txt"), Buffer.from("Original input"));
    let calls = 0;
    const backend = new FakeBackend(async (spec) => {
      calls++;
      if (spec.writable) {
        await writeFile(resolve(spec.cwd, "source.txt"), Buffer.from("Worker candidate"));
        await chmod(
          resolve(spec.cwd, "source.txt"),
          executable ? WorkspaceMode.PrivateExecutable : WorkspaceMode.PrivateFile,
        );
      } else if (changed) await replaceCandidate(run, "deliver");
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
      plan: validateWorkflow(vendorRecoveryWorkflow("Review publication commitment")),
      backend: Backend.Fake,
      client_id: "candidate-publication",
      submission_id: "one",
    });
    await engine.start(run.run_id);
    const final = await engine.snapshot(run.run_id);
    const node = final.nodes.deliver;
    assert.ok(node);
    assert.equal(final.state, changed ? RunStatus.Blocked : RunStatus.Passed);
    assert.equal(node.state, changed ? StepStatus.Blocked : StepStatus.Passed);
    assert.equal(node.attempt, 1);
    assert.equal(node.refutations, 0);
    assert.deepEqual(node.evidence, []);
    assert.equal(calls, 2);
    assert.equal(node.phases[ExecutionPhase.Worker]?.completed, true);
    assert.equal(node.phases[`${ExecutionPhase.FalsifierPrefix}0`]?.completed, true);
    assert.ok(node.phases[ExecutionPhase.Worker]?.candidate_hash);
    if (changed) assert.equal(final.artifacts, null);
    else assert.ok(final.artifacts);
    return true;
  });
}
