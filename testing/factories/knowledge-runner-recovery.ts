import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  KnowledgeAttemptState,
  type KnowledgeKind,
  type KnowledgePublicationStage,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { all } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { Engine, runKnowledgeScope } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { Run } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { knowledgeAttemptChanges } from "./knowledge-attempts.ts";

export async function knowledgeRunnerRecovery(
  stage: KnowledgePublicationStage,
  kind: KnowledgeKind,
) {
  async function observe(root: string) {
    const project = join(root, "project");
    const home = join(root, "home");
    await all([() => mkdir(project), () => mkdir(home)]);
    let hub = await KnowledgeHub.open(home, {}, async (current) => {
      if (current === stage) throw new Error("Interrupted checked publication");
    });
    const plan = validateWorkflow(vendorRecoveryWorkflow());
    const step = plan.nodes[0];
    assert.ok(step);
    const mutations = knowledgeAttemptChanges(kind);
    let run: Run;
    let workers = 0;
    let checkers = 0;
    const backend = new FakeBackend(async (spec) => {
      const state = run.nodes[step.id];
      assert.ok(state);
      if (spec.writable) {
        workers++;
        await hub.attempts.stage(runKnowledgeScope(run, step, state), {
          revision: null,
          mutations,
        });
        return { json: { ok: true, marker: "candidate", turn: 1 } };
      }
      checkers++;
      return { json: { verdict: Verdict.Survived, evidence: "Checked before interruption" } };
    });
    const factory = () => backend;
    let engine = new Engine(factory, {}, { knowledge: hub.attempts });
    try {
      run = await engine.create({
        project,
        plan,
        config: await resolveConfig({ home, project }),
        backend: Backend.Fake,
        client_id: "knowledge-runner",
        submission_id: "recovery",
      });
      await engine.start(run.run_id);
      assert.equal(run.state, RunStatus.Blocked);
      const blocked = run.nodes[step.id];
      assert.ok(blocked);
      assert.equal(blocked.attempt, 1);
      assert.equal(blocked.refutations, 0);
      const scope = runKnowledgeScope(run, step, blocked);
      await assert.rejects(hub.attempts.read(scope), { code: ErrorCode.KnowledgeUnavailable });
      await hub.close();
      hub = await KnowledgeHub.open(home);
      assert.equal((await hub.attempts.read(scope))?.state, KnowledgeAttemptState.Prepared);
      engine = new Engine(factory, {}, { knowledge: hub.attempts });
      run = await engine.load(run.root);
      await engine.resume(run.run_id);
      assert.equal(run.state, RunStatus.Passed);
      assert.equal(workers, 1);
      assert.equal(checkers, 1);
      assert.equal(run.nodes[step.id]?.attempt, 1);
      assert.equal(run.nodes[step.id]?.refutations, 0);
      const published = await hub.attempts.read(scope);
      assert.equal(published?.state, KnowledgeAttemptState.Published);
      assert.ok(published?.receipt);
      assert.deepEqual(await hub.attempts.publish(scope, 1), published);
      for (const mutation of mutations) assert.equal((await hub.get(mutation.id)).entry.version, 1);
      assert.equal((await engine.usage(run.run_id)).executions, 2);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeRunnerArtifact(kind: KnowledgeKind, changed: boolean) {
  async function observe(root: string) {
    const project = join(root, "project");
    const home = join(root, "home");
    await all([() => mkdir(project), () => mkdir(home)]);
    const hub = await KnowledgeHub.open(home);
    const plan = validateWorkflow(vendorRecoveryWorkflow());
    const step = plan.nodes[0];
    assert.ok(step);
    const mutations = knowledgeAttemptChanges(kind);
    let run: Run;
    const backend = new FakeBackend(async (spec) => {
      const state = run.nodes[step.id];
      assert.ok(state);
      if (spec.writable) {
        await writeFile(join(spec.cwd, "delivery.txt"), Buffer.from("Checked original"));
        await hub.attempts.stage(runKnowledgeScope(run, step, state), {
          revision: null,
          mutations,
        });
        return { json: { ok: true, marker: "candidate", turn: 1 } };
      }
      if (changed)
        await writeFile(
          join(spec.cwd, "..", "candidate", "delivery.txt"),
          Buffer.from("Unverified replacement"),
        );
      return { json: { verdict: Verdict.Survived, evidence: "Checked original candidate" } };
    });
    const engine = new Engine(() => backend, {}, { knowledge: hub.attempts });
    try {
      run = await engine.create({
        project,
        plan,
        config: await resolveConfig({ home, project }),
        backend: Backend.Fake,
        client_id: "knowledge-runner",
        submission_id: "artifact",
      });
      await engine.start(run.run_id);
      assert.equal(run.state, changed ? RunStatus.Blocked : RunStatus.Passed);
      const state = run.nodes[step.id];
      assert.ok(state);
      const document = await hub.attempts.read(runKnowledgeScope(run, step, state));
      assert.equal(
        document?.state,
        changed ? KnowledgeAttemptState.Open : KnowledgeAttemptState.Published,
      );
      assert.equal((await hub.search({ kind })).results.length, changed ? 0 : 2);
      assert.equal(state.refutations, 0);
      assert.equal(state.attempt, 1);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
