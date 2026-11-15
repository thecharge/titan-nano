import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  HookFile,
  McpIdentity,
  McpSubmissionFixture,
  Packaging,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { McpTextContentSchema, RunSchema } from "@titan/types";
import { withClientAddress } from "../support/client.ts";
import { writeIsolatedHome } from "../support/isolated.ts";
import { withMcp, withMemoryMcp } from "../support/mcp.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function mcpSubmission(
  parallel: boolean,
  invalid: boolean,
  cli?: string,
): Promise<boolean> {
  return withTemporaryDirectory((root) => observeMcpSubmission(root, parallel, invalid, cli));
}

export function mcpSubmissionProcess(
  parallel: boolean,
  invalid: boolean,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
): Promise<boolean> {
  return mcpSubmission(parallel, invalid, cli);
}

async function observeMcpSubmission(
  root: string,
  parallel: boolean,
  invalid: boolean,
  cli?: string,
): Promise<boolean> {
  await using resources = new AsyncDisposableStack();
  const home = resolve(root, "home");
  const project = resolve(root, "project");
  await mkdir(project);
  const base = checkedWorkflow();
  const step = base.steps[0];
  assert(step);
  const steps = [step, { ...step, id: "two" }];
  const workflow = { ...base, steps: parallel ? [{ parallel: steps }] : steps };
  const file = resolve(project, "workflow.yaml");
  await writeFile(file, Buffer.from(Bun.YAML.stringify(workflow)));
  const release = Promise.withResolvers<void>();
  let workers = 0;
  let checkers = 0;
  const backend = new FakeBackend(async (spec) => {
    if (spec.persona_id !== step.do.persona) {
      checkers++;
      return { json: { verdict: Verdict.Survived, evidence: "Independent check" } };
    }
    workers++;
    await release.promise;
    return { json: { note: "Work completed after tool acknowledgement" } };
  });
  await writeIsolatedHome(home);
  const server = await startServer(home, () => backend);
  resources.defer(() => server.stop());
  resources.defer(() => release.resolve());
  return await withMcp(home, cli, async (client) => {
    const invalidWorkflow = parallel ? { ...workflow, personas: {} } : { ...workflow, steps: [] };
    const input = {
      project,
      workflow: invalid ? invalidWorkflow : workflow,
      backend: Backend.Fake,
      client_id: "main-agent",
      submission_id: "tool-start",
      harness_session_id: "conversation",
      workflow_path: file,
      preserve_source: true,
    };
    const start = performance.now();
    const result = await client.callTool({ name: McpIdentity.Run, arguments: input }, undefined, {
      signal: AbortSignal.timeout(McpSubmissionFixture.AcceptanceMilliseconds),
    });
    assert(performance.now() - start < McpSubmissionFixture.AcceptanceMilliseconds);
    const runs = createRunClient(home);
    if (invalid) {
      assert.equal(result.isError, true);
      assert.equal((await runs.list()).runs.length, 0);
      assert.equal(workers, 0);
      assert.equal(checkers, 0);
      return true;
    }
    assert.notEqual(result.isError, true);
    const run = RunSchema.parse(
      JSON.parse(McpTextContentSchema.parse(result.content)[0]?.text ?? ""),
    );
    assert.equal(run.client_id, input.client_id);
    assert.equal(run.submission_id, input.submission_id);
    assert.equal(run.harness_session_id, input.harness_session_id);
    assert(await waitUntil(async () => workers === (parallel ? 2 : 1)));
    assert.equal((await runs.get(run.run_id)).state, RunStatus.Running);
    assert.equal(checkers, 0);
    release.resolve();
    assert(await waitUntil(async () => (await runs.get(run.run_id)).state === RunStatus.Passed));
    assert.equal(workers, 2);
    assert.equal(checkers, 2);
    return true;
  });
}

export async function mcpSubmissionResponse(state: RunStatus, valid: boolean): Promise<boolean> {
  const snapshot = { run_id: "assigned-run", state, root: "/kept/run", artifacts: null, nodes: {} };
  return withClientAddress(
    Response.json(valid ? snapshot : { ...snapshot, artifacts: 42 }),
    async (home) =>
      withMemoryMcp(home, async (client) => {
        const result = await client.callTool({
          name: McpIdentity.Run,
          arguments: {
            project: "/project",
            workflow: checkedWorkflow(),
            backend: Backend.Fake,
            client_id: "caller",
            submission_id: "submission",
          },
        });
        if (!valid) {
          assert.equal(result.isError, true);
          return false;
        }
        assert.notEqual(result.isError, true);
        const run = JSON.parse(McpTextContentSchema.parse(result.content)[0]?.text ?? "");
        assert.equal(run.run_id, snapshot.run_id);
        assert.equal(run.state, state);
        return true;
      }),
  );
}
