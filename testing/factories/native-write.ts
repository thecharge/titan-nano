import { strict as assert } from "node:assert";
import { link, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  AgentTool,
  Backend,
  ConfigFile,
  FileAccessMode,
  NativeTool,
  RunStatus,
  SdkProcessFixture,
  Verdict,
  WorkspaceModeSetting,
} from "@titan/constants";
import { nativeWritableFiles } from "@titan/core";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { connectNativeTools } from "@titan/server/native-tool-client";
import { agentSpec, vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendFactory,
  ConfigSchema,
  McpTextContentSchema,
  type NativeBackendId,
  NativeFileResultSchema,
  NativeToolBoardSchema,
  type NativeToolConnection,
  type SdkProbePaths,
} from "@titan/types";
import { sourceVersion, writeWorkspaceFile } from "@titan/workspace";
import { nativeValue } from "./native-tools.ts";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export function nativeWorkspaceWrite(mode: string, refused: boolean) {
  return withTemporaryDirectory(async (root) => {
    await mkdir(resolve(root, "project"));
    const project = resolve(root, "project");
    const file = resolve(project, "allowed.txt");
    await writeFile(file, "Original");
    const version = await sourceVersion(file);
    let path = "allowed.txt";
    let expected: string | null = version;
    if (mode === "create") {
      path = "new/file.txt";
      expected = null;
    }
    if (mode === "empty")
      await writeWorkspaceFile(project, { path, content: "", expected_version: version });
    if (mode === "empty") expected = await sourceVersion(file);
    if (mode === "stale") expected = "stale";
    if (mode === "existing") expected = null;
    if (mode === "missing") path = "absent/file.txt";
    if (mode === "file-parent") path = "allowed.txt/file.txt";
    if (mode === "symlink-parent") {
      await symlink(project, resolve(project, "alias"));
      path = "alias/created.txt";
      expected = null;
    }
    if (mode === "linked") await link(file, resolve(root, "outside.txt"));
    const write = writeWorkspaceFile(project, {
      path,
      content: "Changed",
      expected_version: expected,
    });
    if (refused) await assert.rejects(write);
    else await write;
    assert.equal(
      await readFile(file, "utf8"),
      refused || mode === "create" ? "Original" : "Changed",
    );
    if (!refused) assert.equal(await readFile(resolve(project, path), "utf8"), "Changed");
    return true;
  });
}

export function nativeManagedSdkWrite(
  backend: NativeBackendId,
  refused: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory(async (root) => {
    const { home, project } = await prepareSdkProject(root, backend, 0, false, paths.vendors);
    const file = resolve(home, ConfigFile.User);
    const config = ConfigSchema.parse(JSON.parse(await readFile(file, "utf8")));
    config.workspace = { ...config.workspace, mode: WorkspaceModeSetting.Live };
    config.defaults.max_attempts = 1;
    await writeFile(file, JSON.stringify(config));
    const child = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    try {
      assert.ok(
        await waitUntil(() => serverReady(home, child.pid), SdkProcessFixture.ObserveAttempts),
      );
      const task = refused ? "native_file_write_refused" : "native_file_write";
      const original = vendorRecoveryWorkflow(task);
      const workflow = {
        ...original,
        steps: original.steps.map((step) => ({
          ...step,
          do: { ...step.do, task },
          files: refused ? ["created.txt"] : ["source.txt", "created.txt"],
        })),
      };
      const client = createRunClient(home);
      const submitted = await client.submit({
        project,
        backend,
        workflow,
        client_id: "sdk-write",
        submission_id: "sdk-write",
      });
      assert.ok(
        await waitUntil(async () => {
          const run = await client.get(submitted.run_id);
          return (
            run.state === RunStatus.Passed ||
            run.state === RunStatus.Blocked ||
            run.state === RunStatus.Failed
          );
        }, SdkProcessFixture.ObserveAttempts),
      );
      const run = await client.get(submitted.run_id);
      assert.equal(run.state, RunStatus.Passed, JSON.stringify(run.nodes));
      assert.equal(
        await readFile(resolve(project, "source.txt"), "utf8"),
        refused ? "Original project content" : "Managed native update",
      );
      assert.equal(
        await readFile(resolve(project, "created.txt"), "utf8"),
        "Managed native creation",
      );
      await assert.rejects(() => readFile(resolve(project, "outside.txt")), { code: "ENOENT" });
      const events = await client.events(run.run_id, { limit: 1000 });
      const writes = events.events.filter(
        (event) =>
          event.type === "tool" &&
          NativeToolBoardSchema.safeParse(event.data).success &&
          NativeToolBoardSchema.parse(event.data).tool === NativeTool.WriteFile,
      );
      assert.equal(writes.length, 4);
      assert.equal(
        writes.filter((event) => NativeToolBoardSchema.parse(event.data).outcome === "refused")
          .length,
        refused ? 3 : 2,
      );
      return true;
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      await child.exited;
    }
  });
}

export function nativeManagedWrite(
  path: string,
  existing: boolean,
  refused = false,
  stale = false,
  readonly = false,
  linked = false,
) {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    const project = resolve(root, "project");
    const home = path.startsWith("runtime/") ? resolve(project, "runtime") : resolve(root, "home");
    await mkdir(project);
    const target = resolve(project, "allowed.txt");
    if (existing) await writeFile(target, "Original");
    if (linked) await link(target, resolve(root, "external.txt"));
    const before = existing ? await stat(target) : undefined;
    const connections = new Map<string, NativeToolConnection>();
    let observed = false;
    const factory: BackendFactory = () => {
      const backend = new FakeBackend(async (spec) => {
        if (spec.persona_id === "checker")
          return { json: { verdict: Verdict.Survived, evidence: "Checked live result" } };
        const connection = connections.get(spec.execution_id);
        assert.ok(connection);
        const remote = await connectNativeTools(connection);
        resources.defer(() => remote.close());
        const current = NativeFileResultSchema.parse(
          await nativeValue(remote.client, NativeTool.ReadFile, {
            path: path === "nested/new.txt" ? path : "allowed.txt",
          }),
        );
        const result = await remote.client.callTool({
          name: NativeTool.WriteFile,
          arguments: {
            path,
            content: "Changed",
            expected_version: stale ? "stale" : current.observation.version,
          },
        });
        assert.equal(result.isError === true, refused);
        if (!refused) {
          const value = NativeFileResultSchema.parse(
            JSON.parse(McpTextContentSchema.parse(result.content)[0]?.text ?? ""),
          );
          assert.equal(Buffer.from(value.content ?? "", "base64").toString(), "Changed");
        }
        observed = true;
        return { json: { ok: true, marker: "written", turn: 1 } };
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
    const original = vendorRecoveryWorkflow();
    const workflow = {
      ...original,
      steps: original.steps.map((step) => ({
        ...step,
        files: ["allowed.txt", "nested/new.txt", "runtime/new.txt"],
      })),
    };
    if (readonly)
      workflow.personas.worker = { ...workflow.personas.worker, tools: [AgentTool.Read] };
    const client = createRunClient(home);
    const run = await client.submit({
      project,
      backend: Backend.Fake,
      client_id: "write",
      submission_id: "write",
      workflow,
    });
    await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed);
    assert.equal(observed, true);
    assert.equal(
      await readFile(target, "utf8").catch(() => undefined),
      refused
        ? existing
          ? "Original"
          : undefined
        : path === "allowed.txt"
          ? "Changed"
          : "Original",
    );
    if (before) assert.equal((await stat(target)).ino, before.ino);
    const events = await client.events(run.run_id, { limit: 1000 });
    assert.ok(
      events.events.some(
        (event) =>
          event.type === "tool" &&
          NativeToolBoardSchema.safeParse(event.data).success &&
          NativeToolBoardSchema.parse(event.data).tool === NativeTool.WriteFile &&
          NativeToolBoardSchema.parse(event.data).outcome === (refused ? "refused" : "returned"),
      ),
    );
    return true;
  });
}

export function nativeFileGrants(
  paths: string[],
  expected: string[],
  linked = false,
  protectedPaths: string[] = [],
  refused = false,
) {
  return withTemporaryDirectory(async (project) => {
    await mkdir(resolve(project, "directory"));
    await mkdir(resolve(project, ".git"));
    await writeFile(resolve(project, "allowed.txt"), "Original");
    await writeFile(resolve(project, "directory/child.txt"), "Child");
    await writeFile(resolve(project, ".git/config"), "Protected");
    if (linked) await link(resolve(project, "allowed.txt"), resolve(project, "alias.txt"));
    const spec = {
      ...agentSpec(project),
      writable: true,
      file_scope: { mode: FileAccessMode.Write, paths, exclude_paths: protectedPaths },
    };
    const work = nativeWritableFiles(spec);
    if (linked || refused) await assert.rejects(work);
    else assert.deepEqual(await work, expected);
    return true;
  });
}
