import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  ErrorCode,
  FileEncoding,
  HttpHeader,
  HttpMethod,
  HttpStatus,
  IoLimit,
  LocalServer,
  RunFile,
  RunFormat,
  RunStatus,
  ServerDatabaseAdapter,
  ServerFile,
  ServerSql,
  SubmissionMutation,
  WorkflowSourceFixture,
} from "@titan/constants";
import { all, hash } from "@titan/core";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { readBytes, readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type Address,
  type Run,
  RunSchema,
  ServerErrorSchema,
  StoredSubmissionSchema,
} from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";

async function postSubmission(address: Address, body: unknown): Promise<Response> {
  return fetch(address.url + LocalServer.Runs, {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.Authorization]: LocalServer.Bearer + address.token,
      [HttpHeader.ContentType]: LocalServer.Json,
    },
    body: JSON.stringify(body),
  });
}

async function submissionFingerprint(run: Run, home: string, workflowPath: string) {
  const database = new Bun.SQL({
    adapter: ServerDatabaseAdapter,
    filename: resolve(home, ServerFile.Database),
    strict: true,
  });
  try {
    const stored = StoredSubmissionSchema.parse(
      (await database.unsafe(ServerSql.Submission, [run.client_id, run.submission_id]))[0],
    );
    const legacy = {
      project: run.project,
      plan: run.plan,
      backend: run.backend,
      config: run.config.hash,
      workflow_path: workflowPath,
    };
    const expected =
      run.harness_session_id === undefined
        ? legacy
        : { ...legacy, harness_session_id: run.harness_session_id };
    assert.equal(stored.request_hash, hash(JSON.stringify(expected)));
  } finally {
    await database.close();
  }
}

export async function serverSubmission(
  restart: boolean,
  mutation: SubmissionMutation,
  emptyPath = false,
  discardResponse = false,
  callerSession?: string,
) {
  async function observe(root: string) {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await all([() => mkdir(home), () => mkdir(project)]);
    let server = await startServer(home, createFakeBackend);
    try {
      assert.equal(
        (await fetch(server.address.url + LocalServer.Runs)).status,
        HttpStatus.Unauthorized,
      );
      const client = createRunClient(home);
      const workflow = vendorRecoveryWorkflow();
      const body = {
        workflow,
        project,
        backend: Backend.Fake,
        client_id: "submission-owner",
        submission_id: "submission-one",
        ...(callerSession !== undefined ? { harness_session_id: callerSession } : {}),
        workflow_path: emptyPath ? "" : "workflow.yaml",
      };
      if (discardResponse) {
        const discarded = await postSubmission(server.address, body);
        assert.equal(discarded.status, HttpStatus.Created);
        await discarded.body?.cancel();
        assert.ok(
          await waitUntil(async () => {
            const page = await client.list();
            return page.runs.length === 1 && page.runs[0]?.state === RunStatus.Passed;
          }),
        );
      }
      if (discardResponse && restart) {
        await server.stop();
        server = await startServer(home, createFakeBackend);
      }
      const first = RunSchema.parse(await client.submit(body));
      assert.ok(
        await waitUntil(
          async () => RunSchema.parse(await client.get(first.run_id)).state === RunStatus.Passed,
        ),
      );
      const before = RunSchema.parse(await client.get(first.run_id));
      assert.equal(before.harness_session_id, callerSession);
      await submissionFingerprint(before, home, body.workflow_path);
      assert.equal(
        RunSchema.safeParse({
          ...before,
          schema_version: callerSession === undefined ? RunFormat.CallerSessions : RunFormat.Legacy,
        }).success,
        false,
      );
      assert.equal(
        before.schema_version,
        before.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
      );
      if (restart) {
        await server.stop();
        server = await startServer(home, createFakeBackend);
      }
      const candidate =
        mutation === SubmissionMutation.Goal
          ? { ...body, workflow: { ...workflow, goal: "Changed goal" } }
          : mutation === SubmissionMutation.Path
            ? { ...body, workflow_path: undefined }
            : mutation === SubmissionMutation.Session
              ? { ...body, harness_session_id: "another-caller-session" }
              : body;
      if (mutation === SubmissionMutation.None) {
        assert.equal((await client.submit(candidate)).run_id, first.run_id);
      } else {
        await assert.rejects(client.submit(candidate), { code: ErrorCode.SubmissionConflict });
        const refused = await postSubmission(server.address, candidate);
        assert.equal(refused.status, HttpStatus.Conflict);
        assert.ok(refused.body);
        assert.equal(
          ServerErrorSchema.parse(
            JSON.parse(
              (await readBytes(refused.body, IoLimit.ResponseBytes)).toString(FileEncoding.Utf8),
            ),
          ).code,
          ErrorCode.SubmissionConflict,
        );
      }
      assert.equal((await client.submit(body)).run_id, first.run_id);
      const after = RunSchema.parse(await client.get(first.run_id));
      assert.deepEqual(after, before);
      assert.equal(after.nodes.deliver?.phases.worker?.executions, 1);
      assert.equal(after.nodes.deliver?.attempt, 1);
      assert.ok((await client.events(first.run_id)).events.length > 3);
      const listed = await client.list();
      assert.equal(listed.runs.length, 1);
      assert.equal(listed.runs[0]?.run_id, first.run_id);
      assert.equal(listed.runs[0]?.harness_session_id, callerSession);
      return true;
    } finally {
      await server.stop();
    }
  }
  return withTemporaryDirectory(observe);
}

export async function workflowSourceSubmission(mode: WorkflowSourceFixture): Promise<boolean> {
  async function observe(root: string) {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    const workflow = vendorRecoveryWorkflow();
    const path = resolve(root, "workflow.yaml");
    const original = Buffer.from(
      mode === WorkflowSourceFixture.Json
        ? JSON.stringify(workflow, null, 2)
        : `# Retain original source α\r\n${Bun.YAML.stringify(workflow).replaceAll("\n", "\r\n")}`,
    );
    if (mode !== WorkflowSourceFixture.Missing) await writeFile(path, original);
    if (mode === WorkflowSourceFixture.Mismatch)
      await writeFile(path, Buffer.from(JSON.stringify({ ...workflow, goal: "Different source" })));
    if (mode === WorkflowSourceFixture.TooLarge)
      await writeFile(path, Buffer.alloc(IoLimit.DataBytes + 1));
    const body = {
      project,
      workflow,
      backend: Backend.Fake,
      workflow_path: mode === WorkflowSourceFixture.Relative ? "workflow.yaml" : path,
      preserve_source: true,
      client_id: "source-owner",
      submission_id: "source-one",
    };
    const server = await startServer(home, createFakeBackend);
    const client = createRunClient(home);
    try {
      if (
        mode !== WorkflowSourceFixture.Yaml &&
        mode !== WorkflowSourceFixture.Json &&
        mode !== WorkflowSourceFixture.Changed
      ) {
        const error = await thrownBy(() => client.submit(body));
        assert.equal(
          Reflect.get(Object(error), "code"),
          mode === WorkflowSourceFixture.Mismatch
            ? ErrorCode.InvalidWorkflow
            : ErrorCode.InvalidSubmission,
        );
        assert.equal((await client.list()).runs.length, 0);
        await writeFile(path, original);
        body.workflow_path = path;
      }
      const first = RunSchema.parse(await client.submit(body));
      assert.ok(
        await waitUntil(async () => (await client.get(first.run_id)).state === RunStatus.Passed),
      );
      const kept = resolve(first.root, RunFile.Workflow);
      assert.deepEqual(await readFileBytes(kept, IoLimit.DataBytes), original);
      if (mode === WorkflowSourceFixture.Changed) {
        await writeFile(path, Buffer.concat([Buffer.from("# Changed comment\n"), original]));
        const error = await thrownBy(() => client.submit(body));
        assert.equal(Reflect.get(Object(error), "code"), ErrorCode.SubmissionConflict);
        assert.equal((await client.list()).runs.length, 1);
        assert.deepEqual(await readFileBytes(kept, IoLimit.DataBytes), original);
        return true;
      }
      assert.equal((await client.submit(body)).run_id, first.run_id);
      return true;
    } finally {
      await server.stop();
    }
  }
  return withTemporaryDirectory(observe);
}
