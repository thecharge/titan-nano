import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  type KnowledgeKind,
  KnowledgeState,
  RunEventKind,
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
import { knowledgeDraft } from "./knowledge.ts";

export async function knowledgeStepFact(kind: KnowledgeKind, refuted: boolean) {
  async function observe(root: string) {
    const project = join(root, "project");
    const home = join(root, "home");
    await all([() => mkdir(project), () => mkdir(home)]);
    const hub = await KnowledgeHub.open(home);
    const plan = validateWorkflow(vendorRecoveryWorkflow());
    const step = plan.nodes[0];
    assert.ok(step);
    const added: string[] = [];
    let run: Run;
    const backend = new FakeBackend(async (spec) => {
      const state = run.nodes[step.id];
      assert.ok(state);
      if (spec.writable) {
        const result = await hub
          .view(runKnowledgeScope(run, step, state))
          .add({ private_revision: null, entry: knowledgeDraft(kind) });
        added.push(result.entry.id);
        return { json: { ok: true, marker: "candidate", turn: 1 } };
      }
      return {
        json: {
          verdict: refuted ? Verdict.Refuted : Verdict.Survived,
          evidence: "Checked private fact",
        },
      };
    });
    const engine = new Engine(() => backend, {}, { knowledge: hub.attempts });
    try {
      run = await engine.create({
        project,
        plan,
        config: await resolveConfig({
          home,
          project,
          overrides: { defaults: { max_attempts: 2 } },
        }),
        backend: Backend.Fake,
        client_id: "knowledge-step-fact",
        submission_id: "step-fact",
      });
      await engine.start(run.run_id);
      const types = (await engine.events(run.run_id)).events.map((event) => event.type);
      if (refuted) {
        assert.equal(run.state, RunStatus.Failed);
        assert.equal(added.length, 2);
        for (const id of added)
          await assert.rejects(hub.get(id), { code: ErrorCode.KnowledgeMissing });
        assert.equal(types.filter((type) => type === RunEventKind.KnowledgeAdded).length, 2);
        assert.equal(types.filter((type) => type === RunEventKind.KnowledgeUndone).length, 2);
        return true;
      }
      assert.equal(run.state, RunStatus.Passed);
      assert.equal(added.length, 1);
      const state = run.nodes[step.id];
      assert.ok(state);
      const seen = await hub.view(runKnowledgeScope(run, step, state)).get(added[0] ?? "");
      assert.equal(seen.visibility, KnowledgeState.Final);
      assert.equal((await hub.get(added[0] ?? "")).entry.kind, kind);
      assert.equal(types.includes(RunEventKind.KnowledgeUndone), false);
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
