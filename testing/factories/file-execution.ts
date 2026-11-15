import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { initialPhase, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  FileAccessMode,
  RunEventKind,
  RunFormat,
  StepStatus,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { invocationId } from "@titan/messages";
import { Engine, FileAccess } from "@titan/runner";
import { claimHostFiles } from "@titan/runtime";
import { agentSpec, vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { AgentSpecSchema, FileExecutionClaimSchema, type ScriptExecution } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";

async function executionCase(mode: string, specification: boolean, validation = false) {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const listed = workflow.steps[0];
    assert.ok(listed);
    const plan = validateWorkflow({
      ...workflow,
      steps: [{ ...listed, ...(mode === "root" ? {} : { files: ["src/one.txt"] }) }],
    });
    const engine = new Engine(() => createFakeBackend());
    const run = await engine.create({
      project,
      plan,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "binding",
      submission_id: "binding",
    });
    const step = plan.nodes[0];
    assert.ok(step);
    const state = run.nodes[step.id];
    assert.ok(state);
    state.state = StepStatus.Running;
    state.phases.worker = initialPhase();
    if (mode === "mixed" || mode === "cross-read") {
      state.read_paths = ["dependencies"];
      run.schema_version = RunFormat.ReadClaims;
    }
    const store = new RunStore(run.root);
    await store.read();
    let fail = false;
    const files = new FileAccess(async (current, type, data) => {
      if (fail && type === RunEventKind.FileAccessBound)
        throw new Error("Binding persistence unavailable");
      await store.commit(current, type, data);
    }, 4);
    const origin = {
      step_id: step.id,
      attempt: state.attempt,
      phase: "worker",
      execution_id: newId(),
    };
    await files.use(run, step, new AbortController().signal, async () => {
      if (mode === "stale-attempt" || mode === "cross-step") {
        const invalid = {
          ...origin,
          attempt: mode === "stale-attempt" ? origin.attempt + 1 : origin.attempt,
          step_id: mode === "cross-step" ? "other-step" : step.id,
        };
        assert.ok(await thrownBy(() => files.bind(run, step, invalid)));
        assert.equal(state.phases.worker?.file_claim, undefined);
        return;
      }
      const binding = await files.bind(run, step, origin);
      assert.ok(binding);
      assert.deepEqual(state.phases.worker?.file_claim, binding);
      assert.equal(state.phases.worker?.execution_id, binding.execution_id);
      if (mode === "commit-failure") {
        fail = true;
        assert.ok(
          await thrownBy(() => files.bind(run, step, { ...origin, execution_id: newId() })),
        );
        assert.deepEqual(state.phases.worker?.file_claim, binding);
        assert.equal(state.phases.worker?.execution_id, binding.execution_id);
        fail = false;
      }
      if (mode === "missing-phase") delete state.phases.worker;
      if (mode === "paused-binding") state.state = StepStatus.Waiting;
      if (["missing-phase", "paused-binding"].includes(mode)) {
        assert.ok(await thrownBy(() => files.bind(run, step, origin)));
        return;
      }
      if (validation) {
        const checkpoint = state.phases.worker;
        assert.ok(checkpoint);
        const execution: ScriptExecution = {
          ...origin,
          run_id: run.run_id,
          file_claim: binding,
        };
        if (mode === "missing-binding") execution.file_claim = undefined;
        if (mode === "missing-board") delete checkpoint.file_claim;
        if (mode === "cross-run") execution.file_claim = { ...binding, run_id: "other-run" };
        if (mode === "cross-execution") execution.execution_id = newId();
        if (mode === "cross-phase") execution.phase = "check-0";
        if (mode === "cross-attempt") execution.attempt++;
        if (mode === "cross-claim") execution.file_claim = { ...binding, claim_id: newId() };
        if (mode === "cross-path") execution.file_claim = { ...binding, paths: [project] };
        if (mode === "cross-checkpoint") checkpoint.execution_id = newId();
        if (mode === "completed") checkpoint.completed = true;
        if (mode === "paused") state.state = StepStatus.Waiting;
        const error = await thrownBy(() => files.validate(run, execution));
        const valid = ["listed", "root", "released"].includes(mode);
        assert.equal(error === undefined, valid);
        if (!valid) {
          assert.ok(error instanceof TitanError);
          assert.equal(error.code, ErrorCode.PermissionDenied);
        }
      }
      if (!specification) return;
      const spec = agentSpec(binding.project);
      spec.run_id = run.run_id;
      spec.attempt = state.attempt;
      spec.execution_id = origin.execution_id;
      spec.invocation_id = invocationId(step.id, state.attempt, origin.phase);
      spec.file_scope = {
        mode: binding.mode,
        paths: step.files ?? ["."],
        read_paths: state.read_paths,
        claim: binding,
      };
      if (mode === "cross-read") spec.file_scope.read_paths = ["other"];
      if (mode === "cross-run") spec.run_id = "other-run";
      if (mode === "cross-execution") spec.execution_id = newId();
      if (mode === "cross-scope") spec.file_scope.paths = ["other.txt"];
      if (mode === "cross-mode")
        spec.file_scope.mode =
          binding.mode === FileAccessMode.Read ? FileAccessMode.Write : FileAccessMode.Read;
      const valid = mode === "listed" || mode === "root" || mode === "mixed";
      assert.equal(AgentSpecSchema.safeParse(spec).success, valid);
      await using resources = new AsyncDisposableStack();
      const error = await thrownBy(() => claimHostFiles(spec, resources));
      assert.equal(error === undefined, valid);
    });
    if (mode === "generation")
      await files.use(run, step, new AbortController().signal, async () => {
        const earlier = state.phases.worker?.file_claim;
        assert.ok(earlier);
        const current = await files.bind(run, step, { ...origin, execution_id: newId() });
        assert.ok(current);
        assert.notEqual(current.claim_id, earlier.claim_id);
        const error = await thrownBy(() =>
          files.validate(run, {
            ...origin,
            run_id: run.run_id,
            file_claim: earlier,
          }),
        );
        assert.ok(error instanceof TitanError);
        assert.equal(error.code, ErrorCode.PermissionDenied);
      });
    if (mode === "released") {
      assert.ok(await thrownBy(() => files.bind(run, step, origin)));
      if (validation) {
        const error = await thrownBy(() =>
          files.validate(run, {
            ...origin,
            run_id: run.run_id,
            file_claim: state.phases.worker?.file_claim,
          }),
        );
        assert.ok(error instanceof TitanError);
        assert.equal(error.code, ErrorCode.PermissionDenied);
      }
    }
    let found = false;
    for await (const event of store.events())
      if (event.type === RunEventKind.FileAccessBound) {
        const claim = FileExecutionClaimSchema.parse(event.data);
        if (mode !== "generation") assert.equal(claim.execution_id, origin.execution_id);
        assert.equal(claim.run_id, run.run_id);
        found = true;
      }
    assert.equal(found, !["stale-attempt", "cross-step"].includes(mode));
    return true;
  });
}

export async function fileExecutionBinding(mode: string) {
  return executionCase(mode, false);
}
export async function fileExecutionSpecification(mode: string) {
  return executionCase(mode, true);
}

export async function fileExecutionValidation(mode: string) {
  return executionCase(mode, false, true);
}
