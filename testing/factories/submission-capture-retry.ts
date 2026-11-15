import { strict as assert } from "node:assert";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { Backend, ErrorCode, RunEventKind, RunStatus, Verdict } from "@titan/constants";
import { registerPersonas } from "@titan/knowledge";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSchema, WorkflowSchema } from "@titan/types";

export function submissionCaptureRetry(link: boolean, restart: boolean, mutation = false) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    await writeFile(resolve(project, "input.txt"), "Stable input");
    await writeFile(resolve(project, "blocked.txt"), "Excess entry");
    if (link) {
      await rm(resolve(project, "blocked.txt"));
      await symlink(resolve(root, "outside.txt"), resolve(project, "blocked.txt"));
    }
    const original = vendorRecoveryWorkflow();
    if (mutation) await registerPersonas(home, WorkflowSchema.parse(original));
    const workflow = mutation
      ? {
          ...original,
          personas: {
            ...original.personas,
            worker: { mutates: "worker@1", role: "Changed transport contract role" },
          },
        }
      : original;
    let dispatches = 0;
    const backend = new FakeBackend(async (spec) => {
      dispatches++;
      return {
        json: spec.writable
          ? { ok: true, marker: "candidate", turn: 1 }
          : { verdict: Verdict.Survived, evidence: "Checked retry" },
      };
    });
    const factory = () => backend;
    let server = await startServer(home, factory);
    try {
      const client = createRunClient(home);
      const body = {
        project,
        workflow,
        backend: Backend.Fake,
        client_id: "capture-retry",
        submission_id: "same-submission",
        overrides: { limits: { max_workspace_entries: link ? 100 : 1 } },
      };
      await assert.rejects(client.submit(body), {
        code: link ? ErrorCode.UnsafeSymlink : ErrorCode.WorkspaceEntries,
      });
      const reserved = (await client.list()).runs[0];
      assert.ok(reserved);
      assert.equal(dispatches, 0);
      await rm(resolve(project, "blocked.txt"));
      if (restart) {
        await server.stop();
        server = await startServer(home, factory);
      }
      const retried = await client.submit(body);
      assert.equal(retried.run_id, reserved.run_id);
      assert.ok(
        await waitUntil(async () => (await client.get(retried.run_id)).state === RunStatus.Passed),
        JSON.stringify(
          (await client.events(retried.run_id)).events
            .filter((event) => event.type === RunEventKind.StepBlocked)
            .map((event) => event.data),
        ),
      );
      const completed = RunSchema.parse(await client.get(retried.run_id));
      if (mutation) assert.equal(completed.persona_references?.worker, "worker@2");
      assert.equal(completed.nodes.deliver?.attempt, 1);
      assert.equal(dispatches, 2);
      assert.equal((await client.submit(body)).run_id, retried.run_id);
      assert.equal(dispatches, 2);
      assert.equal((await client.list()).runs.length, 1);
      return true;
    } finally {
      await server.stop();
    }
  });
}

export function submissionProject(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const parent = resolve(root, "project");
    const directory = mode === "directory" || mode === "nested";
    const project =
      mode === "nested" || mode === "file-parent" ? resolve(parent, "nested") : parent;
    if (directory) await mkdir(project, { recursive: true });
    else if (mode !== "missing") await writeFile(parent, "Retain this file");
    let dispatches = 0;
    const server = await startServer(
      home,
      () =>
        new FakeBackend(async (spec) => {
          dispatches++;
          return {
            json: spec.writable
              ? { ok: true, marker: "candidate", turn: 1 }
              : { verdict: Verdict.Survived, evidence: "Checked project" },
          };
        }),
    );
    try {
      const client = createRunClient(home);
      const body = {
        project,
        workflow: vendorRecoveryWorkflow(),
        backend: Backend.Fake,
        client_id: "project-validation",
        submission_id: "project-validation",
      };
      if (directory) {
        const run = await client.submit(body);
        assert.ok(
          await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed),
        );
        assert.equal(dispatches, 2);
        assert.equal((await client.list()).runs.length, 1);
      } else {
        await assert.rejects(client.submit(body), { code: ErrorCode.ProjectPath });
        assert.equal(dispatches, 0);
        assert.equal((await client.list()).runs.length, 0);
        if (mode !== "missing") assert.equal(await Bun.file(parent).text(), "Retain this file");
      }
      return true;
    } finally {
      await server.stop();
    }
  });
}
