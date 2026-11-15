import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  ErrorCode,
  ExitCode,
  IoLimit,
  McpIdentity,
  RunFile,
  RunFormat,
  RunStatus,
  SubmissionSurface,
} from "@titan/constants";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { McpTextContentSchema, RunSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";
import { withMemoryMcp } from "../support/mcp.ts";

export async function submissionSurface(
  surface: SubmissionSurface,
  session: string,
  valid: boolean,
) {
  async function observe(root: string) {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const workflow = vendorRecoveryWorkflow();
    const path = resolve(project, "workflow.yaml");
    const source = Buffer.from(
      `# Preserve source α\r\n${Bun.YAML.stringify(workflow).replaceAll("\n", "\r\n")}`,
    );
    await writeFile(path, source);
    const server = await startServer(home, createFakeBackend);
    const client = createRunClient(home);
    try {
      async function invoke() {
        const body = {
          project,
          workflow,
          backend: Backend.Fake,
          client_id: "surface-caller",
          submission_id: "surface-submission",
          harness_session_id: session,
          workflow_path: path,
          preserve_source: true,
        };
        if (surface === SubmissionSurface.Http) return client.submit(body);
        if (surface === SubmissionSurface.Mcp)
          return withMemoryMcp(home, async (mcp) => {
            const response = await mcp.callTool({ name: McpIdentity.Run, arguments: body });
            assert.notEqual(response.isError, true);
            return JSON.parse(McpTextContentSchema.parse(response.content)[0]?.text ?? "");
          });
        const output: unknown[] = [];
        const cli = createCli({ ...defaultServices, output: (value) => output.push(value) });
        assert.equal(
          await cli([
            "run",
            path,
            "--home",
            home,
            "--project",
            project,
            "--backend",
            Backend.Fake,
            "--client-id",
            body.client_id,
            "--submission-id",
            body.submission_id,
            "--harness-session-id",
            session,
            "--json",
          ]),
          ExitCode.Success,
        );
        return output[0];
      }
      async function refuse() {
        const error = await thrownBy(invoke);
        assert.ok(error);
        if (surface === SubmissionSurface.Http)
          assert.equal(Reflect.get(Object(error), "code"), ErrorCode.InvalidSubmission);
        assert.equal((await client.list()).runs.length, 0);
        return true;
      }
      if (!valid) return await refuse();
      const first = RunSchema.parse(await invoke());
      assert.equal(first.harness_session_id, session);
      assert.equal(
        first.schema_version,
        first.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
      );
      assert.ok(
        await waitUntil(async () => (await client.get(first.run_id)).state === RunStatus.Passed),
      );
      const before = RunSchema.parse(await client.get(first.run_id));
      assert.deepEqual(
        await readFileBytes(resolve(first.root, RunFile.Workflow), IoLimit.DataBytes),
        source,
      );
      assert.equal(RunSchema.parse(await invoke()).run_id, first.run_id);
      assert.deepEqual(await client.get(first.run_id), before);
      const page = await client.list();
      assert.equal(page.runs.length, 1);
      assert.equal(page.runs[0]?.harness_session_id, session);
      return true;
    } finally {
      await server.stop();
    }
  }
  return withTemporaryDirectory(observe);
}
