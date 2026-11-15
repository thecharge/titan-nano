import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { initialPhase, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  RunEventKind,
  RunFormat,
  RuntimeLimit,
  StepStatus,
  WorkspaceModeSetting,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { Engine, FileAccess } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { FileAccessClaimSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function readClaimRevision(mode: string) {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const first = workflow.steps[0];
    assert.ok(first);
    const plan = validateWorkflow({ ...workflow, steps: [{ ...first, files: ["result.txt"] }] });
    const engine = new Engine(() => new FakeBackend());
    const run = await engine.create({
      project,
      plan,
      backend: Backend.Fake,
      client_id: "read-claims",
      submission_id: mode,
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: {
          workspace: {
            mode: mode === "isolated" ? WorkspaceModeSetting.Isolated : WorkspaceModeSetting.Live,
          },
        },
      }),
    });
    const step = plan.nodes[0];
    assert.ok(step);
    const state = run.nodes[step.id];
    assert.ok(state);
    state.state = StepStatus.Running;
    const phase = initialPhase();
    phase.file_reads = [
      {
        path: mode === "own" ? "result.txt" : "dependencies/file.txt",
        version: null,
        hash: null,
        executable: null,
      },
    ];
    if (mode === "parent" || mode === "root")
      phase.file_reads.push({ directory: mode === "root" ? "." : "dependencies", files: [] });
    if (mode === "capacity")
      phase.file_reads = Array.from({ length: RuntimeLimit.PendingOperations + 1 }, (_, index) => ({
        path: `dependency-${index}`,
        version: null,
        hash: null,
        executable: null,
      }));
    state.phases.worker = phase;
    run.schema_version = RunFormat.FileObservations;
    const store = new RunStore(run.root);
    await store.read();
    let failRevision = mode === "commit-failure";
    const files = new FileAccess(async (current, type, data) => {
      if (failRevision && type === RunEventKind.FileAccessRevised) {
        failRevision = false;
        throw new Error("Read intent persistence unavailable");
      }
      await store.commit(current, type, data);
    }, 4);
    if (mode === "released") {
      assert.ok(await thrownBy(() => files.reviseReads(run, step)));
      return true;
    }
    await files.use(run, step, new AbortController().signal, async () => {
      if (mode === "legacy-node" || mode === "legacy-phase") {
        const binding = await files.bind(run, step, {
          step_id: step.id,
          attempt: state.attempt,
          phase: "worker",
          execution_id: newId(),
        });
        assert.ok(binding);
        if (mode === "legacy-node") state.read_paths = ["dependencies"];
        else binding.read_paths = [resolve(project, "dependencies")];
        try {
          const error = await thrownBy(() => store.commit(run, RunEventKind.FileAccessRevised, {}));
          assert.ok(error instanceof TitanError);
          assert.equal(error.code, ErrorCode.CorruptBoard);
        } finally {
          delete state.read_paths;
          delete binding.read_paths;
        }
        return;
      }
      const error = await thrownBy(async () => {
        const changed = await files.reviseReads(run, step);
        assert.equal(changed, mode !== "own" && mode !== "isolated");
      });
      if (mode === "commit-failure" || mode === "capacity") {
        assert.ok(error);
        assert.equal(state.read_paths, undefined);
        assert.equal(run.schema_version, RunFormat.FileObservations);
        if (mode === "commit-failure") assert.equal(await files.reviseReads(run, step), true);
      } else assert.equal(error, undefined);
    });
    if (state.read_paths) {
      const expected = [
        mode === "root" ? "." : mode === "parent" ? "dependencies" : "dependencies/file.txt",
      ];
      assert.deepEqual(state.read_paths, expected);
      assert.deepEqual(step.files, ["result.txt"]);
      const restored = await new RunStore(run.root).read();
      assert.deepEqual(restored.nodes[step.id]?.read_paths, expected);
      await files.use(run, step, new AbortController().signal, async () => {
        assert.equal(await files.reviseReads(run, step), false);
      });
      run.schema_version = RunFormat.FileObservations;
      assert.ok(await thrownBy(() => store.commit(run, RunEventKind.FileAccessRevised, {})));
    }
    return true;
  });
}

export async function readClaimNegotiation(nested: boolean, cancel: boolean) {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const first = workflow.steps[0];
    assert.ok(first);
    const leaf = nested ? "directory/result.txt" : "result.txt";
    const plan = validateWorkflow({
      ...workflow,
      steps: [
        { ...first, files: ["first.txt"] },
        { ...first, id: "peer", files: [nested ? "directory" : leaf] },
      ],
    });
    const engine = new Engine(() => new FakeBackend());
    const run = await engine.create({
      project,
      plan,
      backend: Backend.Fake,
      client_id: "read-claims",
      submission_id: "negotiation",
      config: await resolveConfig({ home: resolve(project, "home"), project }),
    });
    const a = plan.nodes[0];
    const b = plan.nodes[1];
    assert.ok(a && b);
    const state = run.nodes[a.id];
    assert.ok(state);
    state.state = StepStatus.Running;
    state.phases.worker = initialPhase();
    state.phases.worker.file_reads = [{ path: leaf, version: null, hash: null, executable: null }];
    run.schema_version = RunFormat.FileObservations;
    const store = new RunStore(run.root);
    await store.read();
    const events: string[] = [];
    const files = new FileAccess(async (current, type, data) => {
      events.push(type);
      await store.commit(current, type, data);
    }, 4);
    const firstStarted = Promise.withResolvers<void>();
    const peerStarted = Promise.withResolvers<void>();
    const releasePeer = Promise.withResolvers<void>();
    const revised = Promise.withResolvers<void>();
    const controller = new AbortController();
    let resumed = false;
    const firstWork = thrownBy(async () => {
      await files.use(run, a, controller.signal, async () => {
        firstStarted.resolve();
        await peerStarted.promise;
        assert.equal(await files.reviseReads(run, a), true);
      });
      revised.resolve();
      await files.use(run, a, controller.signal, async () => {
        resumed = true;
        assert.equal(await files.reviseReads(run, a), false);
      });
    });
    await firstStarted.promise;
    const peerWork = files.use(run, b, new AbortController().signal, async () => {
      peerStarted.resolve();
      await releasePeer.promise;
    });
    try {
      await revised.promise;
      assert.ok(await waitUntil(async () => events.includes(RunEventKind.FileAccessWaiting)));
      assert.equal(resumed, false);
      assert.ok(
        events.indexOf(RunEventKind.FileAccessReleased) <
          events.indexOf(RunEventKind.FileAccessWaiting),
      );
      if (cancel) controller.abort();
    } finally {
      releasePeer.resolve();
    }
    await peerWork;
    const error = await firstWork;
    assert.equal(error !== undefined, cancel);
    assert.equal(resumed, !cancel);
    assert.equal(state.attempt, 1);
    assert.equal(state.refutations, 0);
    assert.equal(events.includes(RunEventKind.FileAccessWithdrawn), cancel);
    const acquired = [];
    for await (const event of store.events())
      if (event.type === RunEventKind.FileAccessAcquired)
        acquired.push(FileAccessClaimSchema.parse(event.data));
    assert.equal(acquired.length, cancel ? 2 : 3);
    if (!cancel) assert.deepEqual(acquired[2]?.read_paths, [resolve(project, leaf)]);
    return true;
  });
}

export async function readClaimPersistence(nested: boolean, fail: boolean) {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const first = workflow.steps[0];
    assert.ok(first);
    const plan = validateWorkflow({
      ...workflow,
      steps: [
        { ...first, files: ["first.txt"] },
        { ...first, id: "peer", files: ["second.txt"] },
      ],
    });
    const run = await new Engine(() => new FakeBackend()).create({
      project,
      plan,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "read-persistence",
      submission_id: "parallel",
    });
    for (const step of plan.nodes) {
      const state = run.nodes[step.id];
      assert.ok(state);
      state.state = StepStatus.Running;
      state.phases.worker = initialPhase();
      state.phases.worker.file_reads = [
        {
          path: `${nested ? "dependencies/" : ""}${step.id}.txt`,
          version: null,
          hash: null,
          executable: null,
        },
      ];
    }
    run.schema_version = RunFormat.FileObservations;
    const store = new RunStore(run.root);
    await store.read();
    const saving = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let revisions = 0;
    const files = new FileAccess(async (current, type, data) => {
      if (type === RunEventKind.FileAccessRevised) {
        revisions++;
        if (revisions === 1) {
          saving.resolve();
          await release.promise;
          if (fail) throw new Error("Read intent persistence unavailable");
        }
      }
      await store.commit(current, type, data);
    }, 4);
    const [a, b] = plan.nodes;
    assert.ok(a && b);
    const peerReady = Promise.withResolvers<void>();
    const peerQueued = Promise.withResolvers<void>();
    const firstWork = files.use(run, a, new AbortController().signal, async () => {
      await peerReady.promise;
      const pending = thrownBy(() => files.reviseReads(run, a));
      await saving.promise;
      await peerQueued.promise;
      release.resolve();
      assert.equal((await pending) !== undefined, fail);
    });
    const peerWork = files.use(run, b, new AbortController().signal, async () => {
      peerReady.resolve();
      await saving.promise;
      const pending = files.reviseReads(run, b);
      peerQueued.resolve();
      assert.equal(await pending, true);
    });
    try {
      await firstWork;
      await peerWork;
    } finally {
      release.resolve();
    }
    assert.equal(run.schema_version, RunFormat.ReadClaims);
    assert.equal(run.nodes[a.id]?.read_paths !== undefined, !fail);
    assert.deepEqual(run.nodes[b.id]?.read_paths, [`${nested ? "dependencies/" : ""}${b.id}.txt`]);
    const restored = await new RunStore(run.root).read();
    assert.equal(restored.schema_version, RunFormat.ReadClaims);
    assert.deepEqual(restored.nodes[b.id]?.read_paths, run.nodes[b.id]?.read_paths);
    return true;
  });
}
