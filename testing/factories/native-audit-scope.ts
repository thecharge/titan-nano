import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { initialPhase } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ExecutionPhase,
  KnowledgeTool,
  NativeAuditFixture,
  NativeTool,
  NativeToolAudit,
  NativeToolOutcome,
  NativeToolRole,
  RunFormat,
  StepStatus,
} from "@titan/constants";
import { hash, newId } from "@titan/core";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type NativeToolAuditRecord,
  NativeToolBoardSchema,
  type NativeToolScope,
  type Phase,
} from "@titan/types";
import { resolvedPersona, validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";

export function nativeAuditScope(
  mode: NativeAuditFixture,
  worker: boolean,
  fileRead = false,
  access = false,
  part = false,
) {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(() => createFakeBackend());
    const config = await resolveConfig({
      home: resolve(project, "home"),
      project,
      overrides: { limits: { max_workspace_entries: 4 } },
    });
    const run = await engine.create({
      project,
      config,
      backend: Backend.Fake,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      client_id: "audit",
      submission_id: "audit",
    });
    const node = run.nodes.deliver;
    assert.ok(node);
    node.state = StepStatus.Running;
    const key = part
      ? `${ExecutionPhase.PartPrefix}0`
      : worker
        ? ExecutionPhase.Worker
        : `${ExecutionPhase.FalsifierPrefix}0`;
    const phase: Phase = { ...initialPhase(), executions: 1, execution_id: newId() };
    node.phases[key] = phase;
    if (access && mode !== NativeAuditFixture.NoWorkspace) node.work = project;
    if (mode === NativeAuditFixture.NoRead) {
      const persona = resolvedPersona(run.plan.workflow, worker ? "worker" : "checker");
      persona.tools = [];
    }
    const scope: NativeToolScope = {
      ...knowledgeAttemptScope(),
      run_id: run.run_id,
      step_id: "deliver",
      candidate_id: ExecutionPhase.Worker,
      execution_id: phase.execution_id ?? newId(),
      role: worker ? NativeToolRole.Worker : NativeToolRole.Checker,
    };
    const observation = {
      path: "dependency.txt",
      version: "observed-version",
      hash: hash("Observed dependency"),
      executable: false,
    };
    const record: NativeToolAuditRecord = fileRead
      ? {
          tool: NativeTool.ReadFile,
          outcome: NativeToolOutcome.Returned,
          entry_ids: [],
          observation,
        }
      : {
          tool: KnowledgeTool.Search,
          outcome: NativeToolOutcome.Returned,
          entry_ids: [newId(), newId()],
        };
    if (mode === NativeAuditFixture.Capacity || mode === NativeAuditFixture.DuplicateRead) {
      phase.file_reads = Array.from(
        { length: run.config.value.limits.max_workspace_entries },
        (_, index) => ({
          ...observation,
          path:
            index === 0 && mode === NativeAuditFixture.DuplicateRead
              ? observation.path
              : `dependency-${index}.txt`,
        }),
      );
      run.schema_version = RunFormat.FileObservations;
    }
    if (mode === NativeAuditFixture.Execution) scope.execution_id = newId();
    if (mode === NativeAuditFixture.Attempt) scope.attempt++;
    if (mode === NativeAuditFixture.Candidate) scope.candidate_id = "worker-reconciliation-1";
    if (mode === NativeAuditFixture.Generation) {
      run.schema_version = RunFormat.Reconciliation;
      node.reconciliations = [
        {
          input: resolve(run.root, "steps/deliver/attempt-1/reconciliation-1/input"),
          input_hash: hash("Retained input"),
          phases: {
            [ExecutionPhase.Worker]: { ...initialPhase(), capture_pending: true, answer: {} },
          },
        },
      ];
    }
    if (mode === NativeAuditFixture.Role)
      scope.role = worker ? NativeToolRole.Checker : NativeToolRole.Worker;
    if (mode === NativeAuditFixture.Completed) phase.completed = true;
    if (mode === NativeAuditFixture.Extra)
      Reflect.set(record, "private_result", "Private tool body");
    if (mode === NativeAuditFixture.Outcome) record.outcome = NativeToolOutcome.Refused;
    const before = await engine.snapshot(run.run_id);
    const previous = phase.file_reads;
    if (mode === NativeAuditFixture.AuditWrite) run.project = resolve(project, "moved");
    if (mode !== NativeAuditFixture.Valid && mode !== NativeAuditFixture.DuplicateRead) {
      const refused = () =>
        access
          ? engine.readNativeFile(
              scope,
              mode === NativeAuditFixture.UnsafePath ? "../private.txt" : "dependency.txt",
            )
          : engine.recordNativeTool(scope, record);
      await assert.rejects(refused);
      run.project = project;
      assert.deepEqual(phase.file_reads, previous);
      assert.equal((await engine.snapshot(run.run_id)).version, before.version);
      return true;
    }
    if (access) {
      const result = await engine.readNativeFile(scope, "dependency.txt");
      assert.equal(result.content, null);
      record.observation = result.observation;
    }
    await engine.recordNativeTool(scope, record);
    const page = await engine.events(run.run_id);
    const event = page.events.at(-1);
    assert.equal(event?.type, NativeToolAudit.Kind);
    const data = NativeToolBoardSchema.parse(event?.data);
    assert.equal(data.from, worker ? "worker" : "checker");
    assert.deepEqual(data.entry_ids, record.entry_ids);
    assert.equal(data.execution_id, phase.execution_id);
    if (fileRead) {
      assert.equal(run.schema_version, RunFormat.FileObservations);
      assert.equal(
        phase.file_reads?.length,
        mode === NativeAuditFixture.DuplicateRead
          ? run.config.value.limits.max_workspace_entries
          : 1,
      );
      assert.deepEqual(data.observation, record.observation);
    }
    return true;
  });
}
