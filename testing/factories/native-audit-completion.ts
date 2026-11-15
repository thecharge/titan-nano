import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { atomicWrite } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ExecutionPhase,
  KnowledgeAttemptState,
  KnowledgeKind,
  KnowledgeTool,
  NativeToolRole,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { KnowledgeHub } from "@titan/knowledge";
import { Engine, runKnowledgeScope } from "@titan/runner";
import { NativeExecutions } from "@titan/server/native-executions";
import { connectNativeTools } from "@titan/server/native-tool-client";
import { NativeToolAuthority } from "@titan/server/native-tools";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { NativeToolConnection, NativeToolExecutionOwner, Run } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { knowledgeDraft } from "./knowledge.ts";

export function nativeAuditCompletion(worker: boolean, fail: boolean, split = false) {
  return withTemporaryDirectory((root) => completionAtRoot(root, worker, fail, split));
}

async function completionAtRoot(root: string, worker: boolean, fail: boolean, split: boolean) {
  await using resources = new AsyncDisposableStack();
  const home = resolve(root, "home");
  const project = resolve(root, "project");
  await mkdir(project);
  const hub = await KnowledgeHub.open(home);
  resources.defer(() => hub.close());
  const role = worker ? NativeToolRole.Worker : NativeToolRole.Checker;
  const authority: NativeToolAuthority = new NativeToolAuthority(
    hub,
    { max_bindings: 1, max_pending_operations: 2 },
    async (scope, record): Promise<void> => {
      if (fail && scope.role === role && record.tool === KnowledgeTool.Search)
        throw new Error("Private audit failure");
      await engine.recordNativeTool(scope, record);
    },
  );
  resources.defer(() => authority.close());
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => authority.respond(request),
  });
  resources.defer(() => server.stop(true));
  const owner = new NativeExecutions(
    authority,
    () => server.url.href,
    { command: process.execPath, args: [] },
    1000,
  );
  let connection: NativeToolConnection | undefined;
  const nativeTools: NativeToolExecutionOwner = {
    open(scope, current, directory) {
      const execution = owner.open(scope, current, directory);
      connection = execution.binding.connection;
      return execution;
    },
  };
  let run: Run;
  const workflow = vendorRecoveryWorkflow();
  const original = workflow.steps[0];
  assert.ok(original);
  const plan = validateWorkflow(
    split
      ? {
          ...workflow,
          personas: {
            ...workflow.personas,
            worker: {
              description: workflow.personas.worker.description,
              role: workflow.personas.worker.role,
              model: workflow.personas.worker.model,
              tools: workflow.personas.worker.tools,
            },
          },
          steps: [
            { ...original, id: "source" },
            { ...original, split: { parts: "source.parts", width: 1 } },
          ],
        }
      : workflow,
  );
  const step = plan.nodes.find((node) => node.id === "deliver");
  assert.ok(step);
  const backend = new FakeBackend(async (spec) => {
    assert.ok(connection);
    assert.equal(connection.scope.execution_id, spec.execution_id);
    assert.equal(
      connection.scope.role,
      spec.writable ? NativeToolRole.Worker : NativeToolRole.Checker,
    );
    if (spec.invocation_id.startsWith("source/"))
      return {
        json: spec.writable
          ? { parts: [1, 2] }
          : { verdict: Verdict.Survived, evidence: "Checked parts" },
      };
    if (spec.writable) {
      const state = run.nodes.deliver;
      assert.ok(state);
      await atomicWrite(resolve(spec.cwd, "CHECKED.txt"), Buffer.from("Checked artifact"));
      const scope = runKnowledgeScope(run, step, state);
      await hub.view(scope).add({
        private_revision: (await hub.attempts.read(scope))?.revision ?? null,
        entry: knowledgeDraft(KnowledgeKind.Fact),
      });
    }
    if (connection.scope.role === role) {
      const remote = await connectNativeTools(connection);
      try {
        await remote.client
          .callTool({ name: KnowledgeTool.Search, arguments: { kind: KnowledgeKind.Fact } })
          .catch((error: unknown) => error);
      } finally {
        await remote.close();
      }
    }
    return {
      json: spec.writable
        ? { ok: true, marker: "candidate", turn: 1 }
        : { verdict: Verdict.Survived, evidence: "Checked artifact" },
    };
  });
  const engine: Engine = new Engine(() => backend, {}, { nativeTools, knowledge: hub.attempts });
  const overrides = { recovery: { max_retries: 0 } };
  run = await engine.create({
    project,
    plan,
    backend: Backend.Fake,
    config: await resolveConfig({ home, project, overrides }),
    client_id: "audit-completion",
    submission_id: "one",
  });
  await engine.start(run.run_id);
  const result = await engine.snapshot(run.run_id);
  assert.equal(result.state, fail ? RunStatus.Blocked : RunStatus.Passed);
  const node = result.nodes.deliver;
  assert.ok(node);
  assert.equal(node.attempt, 1);
  assert.equal(node.refutations, 0);
  assert.deepEqual(node.evidence, []);
  const key = worker
    ? split
      ? `${ExecutionPhase.PartPrefix}0`
      : ExecutionPhase.Worker
    : `${ExecutionPhase.FalsifierPrefix}0`;
  assert.equal(node.phases[key]?.completed, !fail);
  assert.equal(
    (await hub.search({ kind: KnowledgeKind.Fact })).results.length,
    fail ? 0 : split ? 2 : 1,
  );
  assert.equal(
    (await hub.attempts.read(runKnowledgeScope(run, step, node)))?.state,
    fail ? KnowledgeAttemptState.Open : KnowledgeAttemptState.Published,
  );
  assert.equal(result.artifacts === null, fail);
  return true;
}
