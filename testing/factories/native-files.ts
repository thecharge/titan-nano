import { strict as assert } from "node:assert";
import { chmod, mkdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ConfigFile,
  ExecutionPhase,
  NativeTool,
  NativeToolRole,
  RunAction,
  RunEventKind,
  RunFormat,
  RunStatus,
  SnapshotMutation,
  Verdict,
  WorkspaceMode,
  WorkspaceModeSetting,
} from "@titan/constants";
import { KnowledgeHub } from "@titan/knowledge";
import { Engine } from "@titan/runner";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { NativeExecutions } from "@titan/server/native-executions";
import { connectNativeTools } from "@titan/server/native-tool-client";
import { NativeToolAuthority } from "@titan/server/native-tools";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendFactory,
  ConfigSchema,
  McpTextContentSchema,
  NativeFileListResultSchema,
  NativeFileResultSchema,
  type NativeToolConnection,
  type NativeToolExecutionOwner,
  type Run,
  RunSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { nativeValue } from "./native-tools.ts";

export function nativeSharedReads(nested: boolean, cancel: boolean) {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(resolve(project, "directory"), { recursive: true });
    await writeFile(resolve(project, "shared.txt"), "Stable dependency");
    const peerPath = nested ? "directory/peer.txt" : "peer.txt";
    const client = createRunClient(home);
    const writes = new Set<string>();
    const bothWritten = Promise.withResolvers<void>();
    const releasePeer = Promise.withResolvers<void>();
    const dispatches = new Map<string, number>();
    const factory: BackendFactory = () => {
      const connections = new Map<string, NativeToolConnection>();
      const backend = new FakeBackend(async (spec) => {
        assert.equal(spec.cwd, project);
        const connection = connections.get(spec.execution_id);
        assert.ok(connection);
        const first = spec.file_scope?.paths[0] === "first.txt";
        const dependency = first ? peerPath : cancel ? "shared.txt" : "first.txt";
        if (!spec.writable) {
          assert.deepEqual(spec.file_scope?.read_paths, [dependency]);
          assert.deepEqual(spec.file_scope?.claim?.read_paths, [resolve(project, dependency)]);
          return { json: { verdict: Verdict.Survived, evidence: "Checked shared files" } };
        }
        dispatches.set(spec.run_id, (dispatches.get(spec.run_id) ?? 0) + 1);
        await writeFile(resolve(project, first ? "first.txt" : peerPath), "Completed artifact");
        writes.add(spec.run_id);
        if (writes.size === 2) bothWritten.resolve();
        await bothWritten.promise;
        const remote = await connectNativeTools(connection);
        try {
          const value = NativeFileResultSchema.parse(
            await nativeValue(remote.client, NativeTool.ReadFile, {
              path: dependency,
            }),
          );
          assert.equal(
            Buffer.from(value.content ?? "", "base64").toString(),
            first || !cancel ? "Completed artifact" : "Stable dependency",
          );
        } finally {
          await remote.close();
        }
        if (!first) await releasePeer.promise;
        return { json: { ok: true, marker: "candidate", turn: 1 } };
      });
      return {
        id: backend.id,
        specificationVersion: backend.specificationVersion,
        capabilities: backend.capabilities,
        async validateTurn(spec, _prompt, _session, native) {
          if (native) connections.set(spec.execution_id, native.connection);
        },
        start: (spec) => backend.start(spec),
        resume: (id, spec) => backend.resume(id, spec),
      };
    };
    const server = await startServer(home, factory, {
      nativeTools: { command: process.execPath, args: [] },
    });
    resources.defer(() => server.stop());
    resources.defer(() => releasePeer.resolve());
    const workflow = vendorRecoveryWorkflow();
    const submit = (first: boolean) =>
      client.submit({
        project,
        backend: Backend.Fake,
        client_id: "shared-reads",
        submission_id: first ? "first" : "peer",
        workflow: {
          ...workflow,
          steps: workflow.steps.map((step) => ({
            ...step,
            files: [first ? "first.txt" : nested ? "directory" : peerPath],
          })),
        },
      });
    const first = await submit(true);
    const peer = await submit(false);
    try {
      assert.ok(
        await waitUntil(async () =>
          (await client.events(first.run_id)).events.some(
            (event) => event.type === RunEventKind.FileAccessWaiting,
          ),
        ),
      );
      assert.equal(dispatches.get(first.run_id), 1);
      assert.equal(dispatches.get(peer.run_id), 1);
      if (cancel) await client.control(first.run_id, RunAction.Cancel);
    } finally {
      releasePeer.resolve();
    }
    assert.ok(
      await waitUntil(async () => {
        const a = await client.get(first.run_id);
        const b = await client.get(peer.run_id);
        return (
          [RunStatus.Passed, RunStatus.Cancelled, RunStatus.Blocked].some(
            (state) => state === a.state,
          ) && [RunStatus.Passed, RunStatus.Blocked].some((state) => state === b.state)
        );
      }),
    );
    const a = RunSchema.parse(await client.get(first.run_id));
    const b = RunSchema.parse(await client.get(peer.run_id));
    assert.equal(a.state, cancel ? RunStatus.Cancelled : RunStatus.Passed, JSON.stringify(a.nodes));
    assert.equal(b.state, RunStatus.Passed, JSON.stringify(b.nodes));
    for (const run of [a, b]) {
      assert.equal(
        run.schema_version,
        run.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
      );
      assert.equal(run.nodes.deliver?.attempt, 1);
      assert.equal(run.nodes.deliver?.refutations, 0);
      assert.equal(run.nodes.deliver?.phases.worker?.executions, 1);
      assert.equal(dispatches.get(run.run_id), 1);
    }
    return true;
  });
}

export function nativeServerFiles(
  worker: boolean,
  changed: boolean,
  selected = false,
  reconcile = false,
  allowance = 5,
) {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    await mkdir(home);
    await writeFile(
      resolve(home, ConfigFile.User),
      JSON.stringify(ConfigSchema.parse({ recovery: { max_retries: allowance } })),
    );
    const directory = selected ? "dependencies" : ".";
    const dependency = selected ? "dependencies/dependency.txt" : "dependency.txt";
    if (selected) await mkdir(resolve(project, directory));
    await writeFile(resolve(project, dependency), "Original dependency");
    const client = createRunClient(home);
    let reads = 0;
    let reconciliations = 0;
    let originals = 0;
    const factory: BackendFactory = () => {
      let connection: NativeToolConnection | undefined;
      const backend = new FakeBackend(async (spec, prompt) => {
        assert.equal(spec.cwd, project);
        assert.ok(connection);
        const recovery = JSON.parse(prompt).reconciliation;
        if (spec.writable && recovery) {
          reconciliations++;
          assert.deepEqual(recovery.original_result, { ok: true, marker: "candidate", turn: 1 });
          assert.equal(connection.scope.candidate_id, "worker-reconciliation-1");
        } else if (spec.writable) originals++;
        if (spec.writable) await writeFile(resolve(project, "CHECKED.txt"), "Checked artifact");
        if (connection.scope.role === (worker ? NativeToolRole.Worker : NativeToolRole.Checker)) {
          const remote = await connectNativeTools(connection);
          try {
            if (selected) await symlink(resolve(root, "absent.txt"), resolve(project, "unrelated"));
            const file = NativeFileResultSchema.parse(
              await nativeValue(remote.client, NativeTool.ReadFile, { path: dependency }),
            );
            const listing = NativeFileListResultSchema.parse(
              await nativeValue(remote.client, NativeTool.ListFiles, { directory }),
            );
            assert.equal(
              Buffer.from(file.content ?? "", "base64").toString(),
              reconcile && reconciliations ? "Changed dependency" : "Original dependency",
            );
            assert.equal(listing.observation.files.includes(dependency), true);
            const saved = RunSchema.parse(await client.get(spec.run_id));
            const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
            assert.deepEqual(saved.nodes.deliver?.phases[key]?.file_reads, [
              file.observation,
              listing.observation,
            ]);
            reads++;
          } finally {
            if (selected) await rm(resolve(project, "unrelated"), { force: true });
            await remote.close();
          }
          if (changed && reads === 1)
            await writeFile(resolve(project, dependency), "Changed dependency");
        }
        return {
          json: spec.writable
            ? { ok: true, marker: "candidate", turn: 1 }
            : { verdict: Verdict.Survived, evidence: "Checked artifact" },
        };
      });
      return {
        id: backend.id,
        specificationVersion: backend.specificationVersion,
        capabilities: backend.capabilities,
        async validateTurn(_spec, _prompt, _session, native) {
          if (native) connection = native.connection;
        },
        start: (spec) => backend.start(spec),
        resume: (id, spec) => backend.resume(id, spec),
      };
    };
    const server = await startServer(home, factory, {
      nativeTools: { command: process.execPath, args: [] },
    });
    resources.defer(() => server.stop());
    const workflow = vendorRecoveryWorkflow();
    const run = await client.submit({
      project,
      backend: Backend.Fake,
      client_id: "managed-files",
      submission_id: "server",
      workflow: {
        ...workflow,
        steps: workflow.steps.map((step) => ({ ...step, files: ["CHECKED.txt"] })),
      },
    });
    assert.ok(
      await waitUntil(async () => {
        const state = (await client.get(run.run_id)).state;
        return state === RunStatus.Passed || state === RunStatus.Blocked;
      }),
    );
    const result = RunSchema.parse(await client.get(run.run_id));
    assert.equal(
      result.state,
      changed ? RunStatus.Blocked : RunStatus.Passed,
      JSON.stringify(result.nodes),
    );
    assert.equal(reads, 1);
    assert.equal(
      result.schema_version,
      result.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
    );
    assert.equal(result.nodes.deliver?.attempt, 1);
    assert.equal(result.nodes.deliver?.refutations, 0);
    assert.equal(result.nodes.deliver?.phases.worker?.executions, 1);
    if (reconcile) {
      const original = result.nodes.deliver?.phases.worker;
      assert.ok(original?.completed && original.candidate_hash);
      await client.control(run.run_id, RunAction.Resume);
      assert.ok(
        await waitUntil(async () => {
          const state = (await client.get(run.run_id)).state;
          return state === RunStatus.Passed || state === RunStatus.Blocked;
        }),
      );
      const resumed = RunSchema.parse(await client.get(run.run_id));
      const node = resumed.nodes.deliver;
      assert.ok(node);
      assert.equal(
        resumed.state,
        allowance ? RunStatus.Passed : RunStatus.Blocked,
        JSON.stringify(node),
      );
      assert.equal(originals, 1);
      assert.equal(reconciliations, allowance ? 1 : 0);
      assert.equal(reads, allowance ? 2 : 1);
      assert.equal(node.attempt, 1);
      assert.equal(node.refutations, 0);
      if (allowance) assert.deepEqual(node.reconciliations?.[0]?.phases.worker, original);
      else assert.equal(node.reconciliations, undefined);
      assert.equal((await client.usage(run.run_id)).executions, allowance ? 4 : 2);
    }
    return true;
  });
}

export function nativeFileObservation(
  worker: boolean,
  mutation: SnapshotMutation,
  auditFailure = false,
  present = true,
) {
  return withTemporaryDirectory((root) =>
    observeAtRoot(root, worker, mutation, auditFailure, present, false),
  );
}

export function nativeFileListing(worker: boolean, mutation: SnapshotMutation) {
  return withTemporaryDirectory((root) => observeAtRoot(root, worker, mutation, false, true, true));
}

export function nativeFileIsolated(worker: boolean, mutation: SnapshotMutation) {
  return withTemporaryDirectory((root) =>
    observeAtRoot(root, worker, mutation, false, true, false, WorkspaceModeSetting.Isolated),
  );
}

async function mutateDependency(path: string, mutation: SnapshotMutation): Promise<void> {
  if (mutation === SnapshotMutation.Changed) await writeFile(path, "Changed dependency");
  if (mutation === SnapshotMutation.Deleted) await rm(path);
  if (mutation === SnapshotMutation.Metadata) await chmod(path, WorkspaceMode.PrivateExecutable);
  if (mutation === SnapshotMutation.Grown) {
    await writeFile(`${path}.replacement`, "Original dependency");
    await rename(`${path}.replacement`, path);
  }
}

async function readAndObserve(
  engine: Engine,
  run: Run,
  connection: NativeToolConnection,
  worker: boolean,
  auditFailure: boolean,
  present: boolean,
  listing: boolean,
): Promise<number> {
  await using resources = new AsyncDisposableStack();
  const remote = await connectNativeTools(connection);
  resources.defer(() => remote.close());
  const call = () =>
    remote.client.callTool(
      listing
        ? { name: NativeTool.ListFiles, arguments: { directory: "." } }
        : { name: NativeTool.ReadFile, arguments: { path: "dependency.txt" } },
    );
  if (auditFailure) {
    await assert.rejects(call);
    return 0;
  }
  const reply = await call();
  assert.equal(reply.isError === true, false);
  const raw: unknown = JSON.parse(McpTextContentSchema.parse(reply.content)[0]?.text ?? "");
  const value = listing ? NativeFileListResultSchema.parse(raw) : NativeFileResultSchema.parse(raw);
  if ("content" in value) {
    assert.equal(value.content === null, !present);
    assert.equal(
      value.content === null ? null : Buffer.from(value.content, "base64").toString(),
      present ? "Original dependency" : null,
    );
  }
  const saved = await engine.snapshot(run.run_id);
  assert.equal(saved.schema_version, RunFormat.FileObservations);
  const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
  assert.deepEqual(saved.nodes.deliver?.phases[key]?.file_reads, [value.observation]);
  return 1;
}

async function observeAtRoot(
  root: string,
  worker: boolean,
  mutation: SnapshotMutation,
  auditFailure: boolean,
  present: boolean,
  listing: boolean,
  mode: WorkspaceModeSetting = WorkspaceModeSetting.Live,
) {
  await using resources = new AsyncDisposableStack();
  const home = resolve(root, "home");
  const project = resolve(root, "project");
  await mkdir(project);
  const dependency = resolve(project, "dependency.txt");
  if (present) await writeFile(dependency, "Original dependency");
  const hub = await KnowledgeHub.open(home);
  resources.defer(() => hub.close());
  const authority: NativeToolAuthority = new NativeToolAuthority(
    hub,
    { max_bindings: 1, max_pending_operations: 4 },
    async (scope, record) => {
      if (auditFailure && record.tool === NativeTool.ReadFile) throw new Error("Unavailable audit");
      await engine.recordNativeTool(scope, record);
    },
    undefined,
    (scope, path) => engine.readNativeFile(scope, path),
    (scope, directory) => engine.listNativeFiles(scope, directory),
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
  let reads = 0;
  const backend = new FakeBackend(async (spec) => {
    assert.ok(connection);
    const target =
      connection.scope.role === (worker ? NativeToolRole.Worker : NativeToolRole.Checker);
    if (spec.writable) await writeFile(resolve(spec.cwd, "CHECKED.txt"), "Checked artifact");
    if (target) {
      reads += await readAndObserve(
        engine,
        run,
        connection,
        worker,
        auditFailure,
        present,
        listing,
      );
      await mutateDependency(
        listing && mutation === SnapshotMutation.Changed
          ? resolve(spec.cwd, "new-dependency.txt")
          : resolve(spec.cwd, "dependency.txt"),
        mutation,
      );
    }
    return {
      json: spec.writable
        ? { ok: true, marker: "candidate", turn: 1 }
        : { verdict: Verdict.Survived, evidence: "Checked artifact" },
    };
  });
  const engine: Engine = new Engine(() => backend, {}, { nativeTools });
  const workflow = vendorRecoveryWorkflow();
  const plan = validateWorkflow({
    ...workflow,
    steps: workflow.steps.map((step) => ({ ...step, files: ["CHECKED.txt"] })),
  });
  run = await engine.create({
    project,
    plan,
    backend: Backend.Fake,
    config: await resolveConfig({
      home,
      project,
      overrides: { recovery: { max_retries: 0 }, workspace: { mode } },
    }),
    client_id: "managed-file",
    submission_id: "one",
  });
  await engine.start(run.run_id);
  const result = await engine.snapshot(run.run_id);
  const failed = auditFailure || mutation !== SnapshotMutation.None;
  assert.equal(result.state, failed ? RunStatus.Blocked : RunStatus.Passed);
  assert.equal(reads, auditFailure ? 0 : 1);
  assert.equal(result.nodes.deliver?.attempt, 1);
  assert.equal(result.nodes.deliver?.refutations, 0);
  assert.equal(result.nodes.deliver?.phases.worker?.executions, 1);
  if (!auditFailure) {
    const restored = await new Engine(() => backend).load(run.root);
    assert.equal(
      restored.schema_version,
      failed || mode === WorkspaceModeSetting.Isolated
        ? RunFormat.FileObservations
        : RunFormat.ReadClaims,
    );
    assert.deepEqual(restored.nodes.deliver?.phases, result.nodes.deliver?.phases);
  }
  return true;
}
