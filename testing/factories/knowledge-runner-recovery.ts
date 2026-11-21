import { strict as assert } from "node:assert";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inspectArtifacts } from "@titan/artifacts";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  ExecutionPhase,
  KnowledgeAttemptState,
  KnowledgeFile,
  type KnowledgeKind,
  KnowledgePublicationStage,
  RunEventKind,
  RunStatus,
  VendorFixture,
  VendorStubMode,
  Verdict,
} from "@titan/constants";
import { all } from "@titan/core";
import { KnowledgeHub } from "@titan/knowledge";
import { Engine, runKnowledgeScope } from "@titan/runner";
import { HostedBackend } from "@titan/runtime";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  AgentHostSettingsSchema,
  type ArtifactInspection,
  type NativeBackendId,
  type Run,
  type RunProjectionWriter,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { exists } from "@titan/workspace";
import { knowledgeAttemptChanges } from "./knowledge-attempts.ts";
import { prepareSdkProject } from "./sdk-process.ts";

export async function knowledgeRunnerRecovery(
  stage: KnowledgePublicationStage,
  kind: KnowledgeKind,
  backend: NativeBackendId,
) {
  async function observe(root: string) {
    const { home, project } = await prepareSdkProject(root, backend, 0);
    const config = await resolveConfig({ home, project });
    let interruptions = 0;
    let hub = await KnowledgeHub.open(home, {}, async (current) => {
      if (current !== stage) return;
      interruptions++;
      throw new Error("Interrupted checked publication");
    });
    const plan = validateWorkflow(vendorRecoveryWorkflow(VendorStubMode.Complete));
    const step = plan.nodes[0];
    assert.ok(step);
    const mutations = knowledgeAttemptChanges(kind);
    const stageKnowledge: RunProjectionWriter = async (snapshot, kind, event) => {
      if (
        kind !== RunEventKind.PhaseCompleted ||
        Reflect.get(Object(event?.data), "phase") !== ExecutionPhase.Worker
      )
        return;
      const state = snapshot.nodes[step.id];
      assert.ok(state);
      await hub.attempts.stage(runKnowledgeScope(snapshot, step, state), {
        revision: null,
        mutations,
      });
    };
    const factory = () =>
      new HostedBackend(
        backend,
        config.value.server.backends[backend],
        AgentHostSettingsSchema.parse(config.value.server.agent_host),
      );
    let engine = new Engine(factory, {}, { knowledge: hub.attempts, projectRun: stageKnowledge });
    try {
      let run = await engine.create({
        project,
        plan,
        config,
        backend,
        client_id: "knowledge-runner",
        submission_id: "recovery",
      });
      await engine.start(run.run_id);
      assert.equal(run.state, RunStatus.Blocked);
      assert.equal(interruptions, 1);
      assert.equal(run.artifacts, null);
      const blocked = run.nodes[step.id];
      assert.ok(blocked);
      assert.equal(blocked.attempt, 1);
      assert.equal(blocked.refutations, 0);
      const scope = runKnowledgeScope(run, step, blocked);
      await assert.rejects(hub.attempts.read(scope), { code: ErrorCode.KnowledgeUnavailable });
      const retained = new Map<string, bigint>();
      for (const { id } of mutations) {
        const path = join(home, KnowledgeFile.Directory, kind, id + KnowledgeFile.Markdown);
        if (await exists(path)) retained.set(path, (await stat(path, { bigint: true })).ino);
      }
      assert.equal(
        retained.size,
        stage === KnowledgePublicationStage.Receipt
          ? mutations.length
          : Number(stage === KnowledgePublicationStage.File),
      );
      await hub.close();
      hub = await KnowledgeHub.open(home);
      for (const [path, inode] of retained)
        assert.equal((await stat(path, { bigint: true })).ino, inode);
      const prepared = await hub.attempts.read(scope);
      assert.equal(prepared?.state, KnowledgeAttemptState.Prepared);
      let committedArtifact: ArtifactInspection | undefined;
      const projectRun: RunProjectionWriter = async (snapshot, event) => {
        if (stage !== KnowledgePublicationStage.Receipt || event !== RunEventKind.Passed) return;
        committedArtifact = await inspectArtifacts(snapshot);
        throw new Error("Interrupted after durable artifact publication");
      };
      engine = new Engine(factory, {}, { knowledge: hub.attempts, projectRun });
      run = await engine.load(run.root);
      await engine.resume(run.run_id);
      assert.equal(run.state, RunStatus.Passed);
      assert.deepEqual(run.nodes[step.id]?.phases, blocked.phases);
      assert.equal(run.nodes[step.id]?.attempt, 1);
      assert.equal(run.nodes[step.id]?.refutations, 0);
      const artifact = await inspectArtifacts(run);
      if (stage === KnowledgePublicationStage.Receipt)
        assert.deepEqual(artifact, committedArtifact);
      assert.ok(artifact.hash);
      assert.deepEqual(
        artifact.files.map(({ path }) => path).sort(),
        [VendorFixture.Output, VendorFixture.SourceFile].sort(),
      );
      engine = new Engine(factory, {}, { knowledge: hub.attempts });
      const reloaded = await engine.load(run.root);
      assert.throws(() => engine.resume(run.run_id), { code: ErrorCode.TerminalRun });
      assert.equal(reloaded.version, run.version);
      assert.deepEqual(await inspectArtifacts(reloaded), artifact);
      const events = await engine.events(run.run_id);
      assert.equal(events.events.filter(({ type }) => type === RunEventKind.Passed).length, 1);
      const published = await hub.attempts.read(scope);
      assert.equal(published?.state, KnowledgeAttemptState.Published);
      assert.equal(published?.publication_id, prepared?.publication_id);
      assert.ok(published?.receipt);
      assert.deepEqual(await hub.attempts.publish(scope, 1), published);
      for (const mutation of mutations) assert.equal((await hub.get(mutation.id)).entry.version, 1);
      assert.equal((await hub.search({ kind })).results.length, mutations.length);
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
