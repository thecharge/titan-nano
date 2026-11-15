import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  KnowledgeAttemptState,
  type KnowledgeKind,
  RunEventKind,
  RunStatus,
  StepStatus,
  Verdict,
} from "@titan/constants";
import { all } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { Engine, runKnowledgeScope } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { KnowledgeMutation, Run } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { knowledgeDraft } from "./knowledge.ts";
import { knowledgeAttemptChanges } from "./knowledge-attempts.ts";

async function assertMissing(hub: KnowledgeHub, mutations: KnowledgeMutation[]) {
  for (const mutation of mutations)
    await assert.rejects(hub.get(mutation.id), { code: ErrorCode.KnowledgeMissing });
}

export async function knowledgeRunnerDecision(
  kind: KnowledgeKind,
  refuted: boolean,
  exhausted = false,
) {
  async function observe(root: string) {
    const project = join(root, "project");
    const home = join(root, "home");
    await all([() => mkdir(project), () => mkdir(home)]);
    const hub = await KnowledgeHub.open(home);
    const plan = validateWorkflow(vendorRecoveryWorkflow());
    const step = plan.nodes[0];
    assert.ok(step);
    const first = knowledgeAttemptChanges(kind);
    const second = knowledgeAttemptChanges(kind);
    let run: Run;
    let workers = 0;
    const backend = new FakeBackend(async (spec) => {
      const state = run.nodes[step.id];
      assert.ok(state);
      const scope = runKnowledgeScope(run, step, state);
      if (spec.writable) {
        workers++;
        await hub.attempts.stage(scope, {
          revision: null,
          mutations: state.attempt === 1 ? first : second,
        });
        return { json: { ok: true, marker: "candidate", turn: 1 } };
      }
      assert.equal((await hub.search({ kind })).results.length, 0);
      return {
        json: {
          verdict:
            refuted && (state.attempt === 1 || exhausted) ? Verdict.Refuted : Verdict.Survived,
          evidence: "Checked private candidate",
        },
      };
    });
    const engine: Engine = new Engine(
      () => backend,
      {},
      {
        knowledge: {
          read: (scope) => hub.attempts.read(scope),
          discard: (scope, revision) => hub.attempts.discard(scope, revision),
          publish: async (scope, revision) => {
            assert.notEqual(run.nodes[step.id]?.state, StepStatus.Passed);
            const published = await hub.attempts.publish(scope, revision);
            assert.equal(
              (await engine.events(run.run_id)).events.some(
                (event) => event.type === RunEventKind.StepPassed,
              ),
              false,
            );
            return published;
          },
        },
      },
    );
    try {
      const overrides = { defaults: { max_attempts: 2 } };
      run = await engine.create({
        project,
        plan,
        config: await resolveConfig({
          home,
          project,
          overrides,
        }),
        backend: Backend.Fake,
        client_id: "knowledge-runner",
        submission_id: "decision",
      });
      await engine.start(run.run_id);
      if (exhausted) {
        assert.equal(run.state, RunStatus.Failed);
        assert.equal(workers, 2);
        const final = run.nodes[step.id];
        assert.ok(final);
        assert.equal(final.refutations, 2);
        const scope = runKnowledgeScope(run, step, final);
        assert.equal((await hub.attempts.read(scope))?.state, KnowledgeAttemptState.Discarded);
        assert.equal(
          (await hub.attempts.read({ ...scope, attempt: 1 }))?.state,
          KnowledgeAttemptState.Discarded,
        );
        await assertMissing(hub, [...first, ...second]);
        return true;
      }
      assert.equal(run.state, RunStatus.Passed);
      assert.equal(workers, refuted ? 2 : 1);
      const state = run.nodes[step.id];
      assert.ok(state);
      assert.equal(state.refutations, refuted ? 1 : 0);
      const kept = refuted ? second : first;
      for (const mutation of kept) assert.equal((await hub.get(mutation.id)).entry.version, 1);
      const scope = runKnowledgeScope(run, step, state);
      const published = await hub.attempts.read(scope);
      assert.equal(published?.state, KnowledgeAttemptState.Published);
      assert.ok(published?.receipt);
      if (refuted) {
        assert.equal(
          (await hub.attempts.read({ ...scope, attempt: 1 }))?.state,
          KnowledgeAttemptState.Discarded,
        );
        await assertMissing(hub, first);
      }
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function knowledgeRunnerConflict(kind: KnowledgeKind, conflict: boolean) {
  async function observe(root: string) {
    const project = join(root, "project");
    const home = join(root, "home");
    await all([() => mkdir(project), () => mkdir(home)]);
    const hub = await KnowledgeHub.open(home);
    const first = await hub.add(knowledgeDraft(kind));
    const second = await hub.add(knowledgeDraft(kind));
    const plan = validateWorkflow(vendorRecoveryWorkflow());
    const step = plan.nodes[0];
    assert.ok(step);
    let run: Run;
    const backend = new FakeBackend(async (spec) => {
      const state = run.nodes[step.id];
      assert.ok(state);
      if (spec.writable) {
        await hub.attempts.stage(runKnowledgeScope(run, step, state), {
          revision: null,
          mutations: [first, second].map((result) => ({
            id: result.entry.id,
            version: 1,
            entry: { ...knowledgeDraft(kind), body: "Checked pending edit" },
          })),
        });
        return { json: { ok: true, marker: "candidate", turn: 1 } };
      }
      if (conflict)
        await hub.update({
          id: second.entry.id,
          version: 1,
          entry: { ...knowledgeDraft(kind), body: "Concurrent final edit" },
        });
      return { json: { verdict: Verdict.Survived, evidence: "Checked candidate" } };
    });
    const engine = new Engine(() => backend, {}, { knowledge: hub.attempts });
    try {
      run = await engine.create({
        project,
        plan,
        config: await resolveConfig({ home, project }),
        backend: Backend.Fake,
        client_id: "knowledge-runner",
        submission_id: "conflict",
      });
      await engine.start(run.run_id);
      assert.equal(run.state, conflict ? RunStatus.Failed : RunStatus.Passed);
      const state = run.nodes[step.id];
      assert.ok(state);
      assert.equal(state.state, conflict ? StepStatus.Failed : StepStatus.Passed);
      assert.equal(state.refutations, 0);
      const document = await hub.attempts.read(runKnowledgeScope(run, step, state));
      assert.equal(
        document?.state,
        conflict ? KnowledgeAttemptState.Open : KnowledgeAttemptState.Published,
      );
      assert.equal((await hub.get(first.entry.id)).entry.version, conflict ? 1 : 2);
      assert.equal((await hub.get(second.entry.id)).entry.version, 2);
      const events = await engine.events(run.run_id);
      assert.equal(
        events.events.some((event) => event.type === RunEventKind.StepPassed),
        !conflict,
      );
      if (conflict) {
        assert.ok(state.evidence.length);
        assert.equal((await hub.get(first.entry.id)).entry.body, first.entry.body);
        assert.equal((await hub.get(second.entry.id)).entry.body, "Concurrent final edit");
        assert.throws(() => engine.resume(run.run_id), { code: ErrorCode.TerminalRun });
      }
      return true;
    } finally {
      await hub.close();
    }
  }
  return withTemporaryDirectory(observe);
}
