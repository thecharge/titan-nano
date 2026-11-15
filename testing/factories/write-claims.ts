import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  RequestDecision,
  RequestKind,
  RunAction,
  RunEventKind,
  RunFormat,
  RunStatus,
  RuntimeLimit,
  StepStatus,
  Verdict,
} from "@titan/constants";
import { Engine, FileAccess } from "@titan/runner";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { resolvedPersona, validateWorkflow } from "@titan/workflow";
import { exists } from "@titan/workspace";

export function writeClaimParent(refuted: boolean, reload: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    await mkdir(resolve(project, "directory"));
    await writeFile(resolve(project, "directory/child.txt"), "original child");
    await writeFile(resolve(project, "directory/peer.txt"), "original peer");
    const base = vendorRecoveryWorkflow();
    const workflow = validateWorkflow({
      ...base,
      steps: base.steps.map((step) => ({ ...step, files: ["result.txt"], max_attempts: 1 })),
    }).workflow;
    resolvedPersona(workflow, "worker").request_turns = true;
    let calls = 0;
    const backend = new FakeBackend(async (spec) => {
      if (spec.persona_id === "checker")
        return {
          json: {
            verdict: refuted ? Verdict.Refuted : Verdict.Survived,
            evidence: "Checked parent expansion",
          },
        };
      calls++;
      if (calls < 3) {
        if (calls === 2)
          await writeFile(resolve(project, "directory/child.txt"), "earlier candidate");
        return {
          json: {
            result: null,
            requests: [
              {
                kind: RequestKind.Resource,
                scope: {
                  operation: "file_write",
                  resource: calls === 1 ? "directory/child.txt" : "directory",
                  content_hashes: {},
                  arguments: [],
                  environment_names: [],
                },
                expires_at: Date.now() + 60000,
              },
            ],
          },
        };
      }
      assert.deepEqual(spec.file_scope?.paths, ["result.txt", "directory"]);
      await writeFile(resolve(project, "directory/child.txt"), "final candidate");
      await writeFile(resolve(project, "directory/peer.txt"), "final candidate");
      return { json: { result: { ok: true, marker: "candidate", turn: 1 }, requests: [] } };
    });
    let engine = new Engine(() => backend);
    let run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      plan: validateWorkflow(workflow),
      backend: Backend.Fake,
      client_id: "write-claims",
      submission_id: "parent",
    });
    await engine.start(run.run_id);
    for (let turn = 0; turn < 2; turn++) {
      assert.equal(run.state, RunStatus.Waiting);
      if (reload) {
        engine = new Engine(() => backend);
        run = await engine.load(run.root);
      }
      const request = (await engine.requests.list(run.run_id)).find(
        (entry) => entry.answer === null,
      );
      assert.ok(request);
      await engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Approve,
          reason: "Reviewed exact write scope",
        },
        { client_id: "reviewer", authority: ApprovalLevel.Main },
      );
      await engine.resume(run.run_id);
    }
    assert.equal(
      run.state,
      refuted ? RunStatus.Failed : RunStatus.Passed,
      JSON.stringify(run.nodes),
    );
    assert.equal(calls, 3);
    assert.equal(run.nodes.deliver?.attempt, 1);
    assert.equal(run.nodes.deliver?.phases.worker?.retries, 0);
    const baselines = run.nodes.deliver?.write_inputs;
    assert.equal(baselines?.length, 2);
    assert.ok(baselines?.[0] && baselines[1]);
    assert.equal(await exists(resolve(baselines[1].input, "directory/child.txt")), false);
    assert.equal(
      await readFile(resolve(baselines[0].input, "directory/child.txt"), "utf8"),
      "original child",
    );
    assert.equal(
      await readFile(resolve(baselines[1].input, "directory/peer.txt"), "utf8"),
      "original peer",
    );
    assert.equal(
      await readFile(resolve(project, "directory/child.txt"), "utf8"),
      refuted ? "original child" : "final candidate",
    );
    assert.equal(
      await readFile(resolve(project, "directory/peer.txt"), "utf8"),
      refuted ? "original peer" : "final candidate",
    );
    const saved = await new RunStore(run.root).read();
    assert.deepEqual(saved.nodes.deliver?.write_inputs, baselines);
    assert.deepEqual(saved.plan.nodes[0]?.files, ["result.txt"]);
    return true;
  });
}

export function writeClaimServer(approved: boolean, reload: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    await writeFile(resolve(project, "extra.txt"), "external baseline");
    const base = vendorRecoveryWorkflow();
    const workflow = validateWorkflow({
      ...base,
      steps: base.steps.map((step) => ({ ...step, files: ["result.txt"] })),
    }).workflow;
    resolvedPersona(workflow, "worker").request_turns = true;
    let calls = 0;
    const backend = new FakeBackend(async (spec) => {
      assert.equal(spec.cwd, project);
      if (spec.persona_id === "checker")
        return { json: { verdict: Verdict.Survived, evidence: "Checked expanded files" } };
      calls++;
      if (calls === 1)
        return {
          json: {
            result: null,
            requests: [
              {
                kind: RequestKind.Resource,
                scope: {
                  operation: "file_write",
                  resource: "extra.txt",
                  content_hashes: {},
                  arguments: [],
                  environment_names: [],
                },
                expires_at: Date.now() + 60000,
              },
            ],
          },
        };
      assert.deepEqual(
        spec.file_scope?.paths,
        approved ? ["result.txt", "extra.txt"] : ["result.txt"],
      );
      if (approved) await writeFile(resolve(project, "extra.txt"), "expanded candidate");
      return { json: { result: { ok: true, marker: "candidate", turn: 1 }, requests: [] } };
    });
    let server = await startServer(home, () => backend, {
      nativeTools: { command: process.execPath, args: [] },
    });
    resources.defer(() => server.stop());
    const client = createRunClient(home);
    const requests = createRequestClient(home);
    const run = await client.submit({
      project,
      backend: Backend.Fake,
      client_id: "write-claims",
      submission_id: "server",
      workflow,
    });
    assert.ok(
      await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Waiting),
    );
    if (reload) {
      await server.stop();
      server = await startServer(home, () => backend, {
        nativeTools: { command: process.execPath, args: [] },
      });
    }
    const request = (await requests.list({ run_id: run.run_id })).requests[0]?.request;
    assert.ok(request);
    await requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: approved ? RequestDecision.Approve : RequestDecision.Deny,
        reason: "Reviewed exact write scope",
        client_id: "reviewer",
      },
      ApprovalLevel.Main,
    );
    await client.control(run.run_id, RunAction.Resume);
    assert.ok(
      await waitUntil(async () => {
        const current = await client.get(run.run_id);
        return current.state === RunStatus.Passed || current.state === RunStatus.Blocked;
      }),
    );
    const result = await client.get(run.run_id);
    assert.equal(result.state, RunStatus.Passed, JSON.stringify(result));
    const saved = await new RunStore(run.root).read();
    assert.equal(
      saved.schema_version,
      saved.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
    );
    assert.deepEqual(saved.nodes.deliver?.write_paths, approved ? ["extra.txt"] : undefined);
    assert.equal(saved.nodes.deliver?.attempt, 1);
    assert.equal(saved.nodes.deliver?.phases.worker?.executions, 2);
    assert.equal(saved.nodes.deliver?.phases.worker?.retries, 0);
    assert.equal((await client.usage(run.run_id)).executions, 3);
    assert.equal(calls, 2);
    assert.equal(
      await readFile(resolve(project, "extra.txt"), "utf8"),
      approved ? "expanded candidate" : "external baseline",
    );
    return true;
  });
}

export function writeClaimPersistence(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const base = vendorRecoveryWorkflow();
    const plan = validateWorkflow({
      ...base,
      steps: base.steps.map((step) => ({ ...step, files: ["result.txt"] })),
    });
    const engine = new Engine(() => new FakeBackend());
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      plan,
      backend: Backend.Fake,
      client_id: "write-claims",
      submission_id: mode,
    });
    const step = plan.nodes[0];
    assert.ok(step);
    const state = run.nodes[step.id];
    assert.ok(state);
    state.state = StepStatus.Running;
    const path = mode === "own" ? "result.txt" : mode === "runtime" ? "owned" : "extra.txt";
    if (mode === "runtime") run.runtime_paths = ["owned"];
    const request = await engine.requests.open(run.run_id, {
      request_id: "write-scope",
      kind: RequestKind.Resource,
      scope: {
        operation: "file_write",
        resource: path,
        content_hashes: {},
        arguments: mode === "arguments" ? ["unexpected"] : [],
        environment_names: [],
      },
      origin: { client_id: run.client_id, harness_session_id: null },
      expires_at: Date.now() + 60000,
    });
    await engine.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: RequestDecision.Approve,
        reason: "Reviewed exact write scope",
      },
      { client_id: "reviewer", authority: ApprovalLevel.Main },
    );
    const requests = await engine.requests.list(run.run_id);
    if (mode === "capacity") {
      state.write_paths = Array.from(
        { length: RuntimeLimit.PendingOperations - 1 },
        (_, index) => `scope-${index}`,
      );
      run.schema_version = RunFormat.WriteClaims;
    }
    const format = run.schema_version;
    const store = new RunStore(run.root);
    await store.read();
    let failRevision = mode === "commit";
    let failInput = mode === "input";
    const files = new FileAccess(async (current, type, data) => {
      if (failRevision && type === RunEventKind.FileAccessRevised) {
        failRevision = false;
        throw new Error("Write intent persistence unavailable");
      }
      if (failInput && type === RunEventKind.FileWriteInputCaptured) {
        failInput = false;
        throw new Error("Write input persistence unavailable");
      }
      await store.commit(current, type, data);
    }, 4);
    if (mode === "released") {
      assert.ok(await thrownBy(() => files.reviseWrites(run, step, requests, true)));
      return true;
    }
    await files.use(run, step, new AbortController().signal, async () => {
      const error = await thrownBy(async () => {
        assert.equal(
          await files.reviseWrites(run, step, requests, mode !== "checker"),
          mode !== "own",
        );
      });
      const rejected = ["commit", "checker", "capacity", "runtime", "arguments"].includes(mode);
      assert.equal(error !== undefined, rejected);
      if (rejected) {
        assert.equal(run.schema_version, format);
        assert.equal(state.write_paths !== undefined, mode === "capacity");
      }
      if (mode === "commit")
        assert.equal(await files.reviseWrites(run, step, requests, true), true);
    });
    if (["checker", "capacity", "runtime", "arguments", "own"].includes(mode)) return true;
    const inputError = await thrownBy(() =>
      files.use(run, step, new AbortController().signal, async () => {}),
    );
    assert.equal(inputError !== undefined, mode === "input");
    if (mode === "input") {
      assert.equal(state.write_inputs, undefined);
      await files.use(run, step, new AbortController().signal, async () => {});
    }
    const baseline = state.write_inputs?.[0];
    assert.ok(baseline);
    const original = structuredClone(baseline);
    if (mode === "legacy") run.schema_version = RunFormat.Reconciliation;
    if (mode === "path") baseline.input = resolve(project, "other");
    if (mode === "generation") baseline.generation = 1;
    if (mode === "missing-paths") delete state.write_paths;
    if (["legacy", "path", "generation", "missing-paths"].includes(mode)) {
      assert.ok(await thrownBy(() => store.commit(run, RunEventKind.FileAccessRevised, {})));
      state.write_paths = [path];
      state.write_inputs = [original];
      run.schema_version = RunFormat.WriteClaims;
    }
    const restored = await new RunStore(run.root).read();
    assert.deepEqual(restored.nodes[step.id]?.write_inputs, [original]);
    assert.deepEqual(restored.nodes[step.id]?.write_paths, [path]);
    assert.equal(restored.runtime_version, run.runtime_version);
    assert.equal(restored.harness_session_id, run.harness_session_id);
    return true;
  });
}

export function writeClaimNegotiation(nested: boolean, cancel: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const base = vendorRecoveryWorkflow();
    const first = base.steps[0];
    assert.ok(first);
    const plan = validateWorkflow({
      ...base,
      steps: [
        { ...first, files: ["result.txt"] },
        { ...first, id: "peer", files: [nested ? "directory" : "extra.txt"] },
      ],
    });
    const engine = new Engine(() => new FakeBackend());
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      plan,
      backend: Backend.Fake,
      client_id: "write-claims",
      submission_id: "negotiation",
    });
    const [a, b] = plan.nodes;
    assert.ok(a && b);
    const state = run.nodes[a.id];
    assert.ok(state);
    state.state = StepStatus.Running;
    const path = nested ? "directory/extra.txt" : "extra.txt";
    const request = await engine.requests.open(run.run_id, {
      request_id: "write-scope",
      kind: RequestKind.Resource,
      scope: {
        operation: "file_write",
        resource: path,
        content_hashes: {},
        arguments: [],
        environment_names: [],
      },
      origin: { client_id: run.client_id, harness_session_id: null },
      expires_at: Date.now() + 60000,
    });
    await engine.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: RequestDecision.Approve,
        reason: "Reviewed exact write scope",
      },
      { client_id: "reviewer", authority: ApprovalLevel.Main },
    );
    const requests = await engine.requests.list(run.run_id);
    const store = new RunStore(run.root);
    await store.read();
    const events: string[] = [];
    const files = new FileAccess(async (current, type, data) => {
      events.push(type);
      await store.commit(current, type, data);
    }, 4);
    const peerStarted = Promise.withResolvers<void>();
    const firstStarted = Promise.withResolvers<void>();
    const revised = Promise.withResolvers<void>();
    const releasePeer = Promise.withResolvers<void>();
    const controller = new AbortController();
    let resumed = false;
    const firstWork = thrownBy(async () => {
      await files.use(run, a, controller.signal, async () => {
        firstStarted.resolve();
        await peerStarted.promise;
        assert.equal(await files.reviseWrites(run, a, requests, true), true);
      });
      revised.resolve();
      await files.use(run, a, controller.signal, async () => {
        resumed = true;
        assert.equal(await files.reviseWrites(run, a, requests, true), false);
        const baseline = state.write_inputs?.[0];
        assert.ok(baseline);
        assert.equal(
          await readFile(resolve(baseline.input, path), "utf8"),
          "peer before admission",
        );
      });
    });
    await firstStarted.promise;
    const peerWork = files.use(run, b, new AbortController().signal, async () => {
      peerStarted.resolve();
      await releasePeer.promise;
      await mkdir(resolve(project, nested ? "directory" : "."), { recursive: true });
      await writeFile(resolve(project, path), "peer before admission");
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
    assert.equal((await firstWork) !== undefined, cancel);
    assert.equal(resumed, !cancel);
    assert.equal(state.write_inputs !== undefined, !cancel);
    assert.equal(events.includes(RunEventKind.FileAccessWithdrawn), cancel);
    assert.equal(state.attempt, 1);
    assert.equal(state.refutations, 0);
    assert.equal(await readFile(resolve(project, path), "utf8"), "peer before admission");
    const restored = await new RunStore(run.root).read();
    assert.deepEqual(restored.nodes[a.id]?.write_paths, [path]);
    assert.deepEqual(restored.nodes[a.id]?.write_inputs, state.write_inputs);
    return true;
  });
}

export function writeClaimGrant(mode: string, reload: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const existing = mode !== "new" && mode !== "deny-new";
    const denied = mode.startsWith("deny");
    const invalid = mode === "protected" || mode === "traversal";
    const reconciling = mode.startsWith("reconcile");
    const refuted = mode === "refuted" || mode === "reconcile-refuted";
    const path =
      mode === "protected" ? ".git/config" : mode === "traversal" ? "../peer" : "extra.txt";
    if (existing) await writeFile(resolve(project, "extra.txt"), "external baseline");
    const base = vendorRecoveryWorkflow();
    const workflow = validateWorkflow({
      ...base,
      steps: base.steps.map((step) => ({ ...step, files: ["result.txt"], max_attempts: 1 })),
    }).workflow;
    resolvedPersona(workflow, "worker").request_turns = true;
    let calls = 0;
    let checks = 0;
    const backend = new FakeBackend(async (spec) => {
      if (spec.persona_id === "checker") {
        checks++;
        if (reconciling && checks === 1)
          await writeFile(resolve(project, "extra.txt"), "intervening external edit");
        return {
          json: {
            verdict: refuted && (!reconciling || checks > 1) ? Verdict.Refuted : Verdict.Survived,
            evidence: "Checked expanded file scope",
          },
        };
      }
      calls++;
      if (calls === 1) {
        assert.deepEqual(spec.file_scope?.paths, ["result.txt"]);
        return {
          json: {
            result: null,
            requests: [
              {
                kind: RequestKind.Resource,
                scope: {
                  operation: "file_write",
                  resource: path,
                  content_hashes: {},
                  arguments: [],
                  environment_names: [],
                },
                expires_at: Date.now() + 60000,
              },
            ],
          },
        };
      }
      assert.equal(spec.cwd, project);
      assert.deepEqual(spec.file_scope?.paths, denied ? ["result.txt"] : ["result.txt", path]);
      assert.deepEqual(
        spec.file_scope?.claim?.paths,
        spec.file_scope?.paths.map((entry) => resolve(project, entry)),
      );
      if (!denied) await writeFile(resolve(project, path), "expanded candidate");
      if (mode === "tamper") {
        const snapshot = await new RunStore(run.root).read();
        const baseline = snapshot.nodes.deliver?.write_inputs?.[0];
        assert.ok(baseline);
        await writeFile(resolve(baseline.input, "extra.txt"), "altered retained baseline");
      }
      return { json: { result: { ok: true, marker: "candidate", turn: 1 }, requests: [] } };
    });
    const engine = new Engine(() => backend);
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      plan: validateWorkflow(workflow),
      backend: Backend.Fake,
      client_id: "write-claims",
      submission_id: mode,
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Waiting);
    let resumed = reload ? new Engine(() => backend) : engine;
    let restored = reload ? await resumed.load(run.root) : run;
    const request = (await resumed.requests.list(run.run_id))[0];
    assert.ok(request);
    await resumed.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: denied ? RequestDecision.Deny : RequestDecision.Approve,
        reason: "Reviewed exact write scope",
      },
      { client_id: "reviewer", authority: ApprovalLevel.Main },
    );
    await resumed.resume(run.run_id);
    if (reconciling) {
      assert.equal(restored.state, RunStatus.Blocked);
      assert.equal(calls, 2);
      assert.equal(await readFile(resolve(project, path), "utf8"), "intervening external edit");
      if (reload) {
        resumed = new Engine(() => backend);
        restored = await resumed.load(run.root);
      }
      await resumed.resume(run.run_id);
      assert.equal(restored.nodes.deliver?.reconciliations?.length, 1);
      assert.equal(restored.schema_version, RunFormat.WriteClaims);
    }
    assert.equal(
      restored.state,
      invalid || mode === "tamper"
        ? RunStatus.Blocked
        : refuted
          ? RunStatus.Failed
          : RunStatus.Passed,
      JSON.stringify(restored.nodes),
    );
    assert.equal(calls, invalid ? 1 : reconciling ? 3 : 2);
    assert.equal(checks, invalid ? 0 : reconciling ? 2 : 1);
    assert.equal(restored.nodes.deliver?.attempt, 1);
    assert.equal(await exists(resolve(project, "extra.txt")), existing || (!denied && !invalid));
    if (existing || (!denied && !invalid))
      assert.equal(
        await readFile(resolve(project, "extra.txt"), "utf8"),
        refuted && reconciling
          ? "intervening external edit"
          : denied || invalid || refuted
            ? "external baseline"
            : "expanded candidate",
      );
    const saved = await new RunStore(run.root).read();
    assert.equal(saved.state, restored.state);
    if (!denied && !invalid) {
      const events: string[] = [];
      for await (const event of new RunStore(run.root).events()) events.push(event.type);
      assert.ok(events.includes(RunEventKind.FileAccessRevised));
      assert.equal(saved.nodes.deliver?.refutations, refuted ? 1 : 0);
      if (!refuted && mode !== "tamper") assert.ok(saved.nodes.deliver?.changes["extra.txt"]);
    }
    return true;
  });
}
