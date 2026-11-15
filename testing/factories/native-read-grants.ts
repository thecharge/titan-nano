import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  ErrorCode,
  ExecutionPhase,
  NativeToolRole,
  RequestDecision,
  RequestKind,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { resolvedPersona, validateWorkflow } from "@titan/workflow";

export function nativeReadGrant(worker: boolean, mode: string) {
  return withTemporaryDirectory(async (project) => {
    const workflow = validateWorkflow(vendorRecoveryWorkflow()).workflow;
    const persona = resolvedPersona(workflow, worker ? "worker" : "checker");
    persona.tools = persona.tools.filter((tool) => tool !== AgentTool.Read);
    persona.request_turns = true;
    const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
    let calls = 0;
    const backend: FakeBackend = new FakeBackend(async (spec) => {
      const selected = spec.invocation_id.endsWith(`/${key}`);
      const result = spec.writable
        ? { ok: true, marker: "candidate", turn: 1 }
        : { verdict: Verdict.Survived, evidence: "Checked candidate" };
      if (!selected) return { json: result };
      calls++;
      if (calls === 1)
        return {
          json: {
            result: null,
            requests: [
              {
                kind: RequestKind.Tool,
                scope: {
                  operation: "read",
                  resource: mode === "other-tool" ? AgentTool.Glob : AgentTool.Read,
                  content_hashes: {},
                  arguments: [],
                  environment_names: [],
                },
                expires_at: Date.now() + 60000,
              },
            ],
          },
        };
      const phase = run.nodes.deliver?.phases[key];
      assert.ok(phase?.request_turn);
      const previous = phase.request_turn.execution_id;
      if (mode === "other-turn") phase.request_turn.execution_id = newId();
      try {
        const scope = {
          run_id: run.run_id,
          step_id: "deliver",
          part_id: null,
          candidate_id: ExecutionPhase.Worker,
          attempt: 1,
          execution_id: spec.execution_id,
          role: worker ? NativeToolRole.Worker : NativeToolRole.Checker,
        };
        const error = await thrownBy(async () => {
          assert.equal((await engine.readNativeFile(scope, "missing.txt")).content, null);
          assert.deepEqual((await engine.listNativeFiles(scope, ".")).observation.files, []);
        });
        if (mode === "approved") assert.equal(error, undefined);
        else {
          assert.ok(error instanceof TitanError);
          assert.equal(error.code, ErrorCode.PermissionDenied);
        }
      } finally {
        phase.request_turn.execution_id = previous;
      }
      return { json: { result, requests: [] } };
    });
    const engine = new Engine(() => backend);
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      plan: validateWorkflow(workflow),
      backend: Backend.Fake,
      client_id: "read-grants",
      submission_id: mode,
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Waiting);
    const request = (await engine.requests.list(run.run_id))[0];
    assert.ok(request);
    await engine.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: mode === "denied" ? RequestDecision.Deny : RequestDecision.Approve,
        reason: "Reviewed read permission",
      },
      { client_id: "reviewer", authority: ApprovalLevel.Main },
    );
    await engine.resume(run.run_id);
    assert.equal(run.state, RunStatus.Passed, JSON.stringify(run.nodes));
    assert.equal(calls, 2);
    assert.equal(run.nodes.deliver?.attempt, 1);
    return true;
  });
}
