import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  ApprovalLevel,
  Backend,
  NativeTool,
  RequestDecision,
  RunAction,
  RunStatus,
} from "@titan/constants";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { connectNativeTools } from "@titan/server/native-tool-client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type BackendFactory, type NativeToolConnection, ObjectSchema } from "@titan/types";
import { schemaFakeAnswer } from "../support/backend.ts";
import { nativeValue } from "./native-tools.ts";

function nativeWebWorker(mode: string): BackendFactory {
  return () => {
    let connection: NativeToolConnection | undefined;
    const continuation = mode === "approve" || mode === "deny";
    const backend = new FakeBackend(async (spec, prompt) => {
      if (!spec.writable) return schemaFakeAnswer(spec);
      assert.ok(connection);
      const answers = ObjectSchema.parse(JSON.parse(prompt)).request_answers;
      const answer =
        Array.isArray(answers) && answers[0] ? ObjectSchema.parse(answers[0]) : undefined;
      if (answer) assert.equal(typeof answer.request_id, "string");
      const remote = await connectNativeTools(connection);
      const input = {
        url: mode === "cleartext" ? "http://localhost/fixture" : "https://localhost/fixture",
        ...(mode === "unbound" ? { request_id: "f7fefd52-1417-499b-a650-0d6f98232660" } : {}),
        ...(answer ? { request_id: answer.request_id } : {}),
      };
      try {
        const read = () => nativeValue(remote.client, NativeTool.ReadWeb, input);
        if (answer)
          await assert.rejects(() =>
            nativeValue(remote.client, NativeTool.ReadWeb, { ...input, url: `${input.url}/other` }),
          );
        if (mode === "cleartext" || mode === "unbound") await assert.rejects(read);
        else {
          const reply = ObjectSchema.parse(await read());
          if (continuation && !answer) return { json: { result: null, requests: [reply.request] } };
          if (mode === "deny") assert.deepEqual(reply, { decision: RequestDecision.Deny });
          else if (mode === "request")
            assert.equal(ObjectSchema.parse(reply.request).kind, "resource");
          else assert.match(String(reply.error), /public addresses/);
        }
        return continuation
          ? { json: { result: { ok: true, marker: "source reviewed", turn: 2 }, requests: [] } }
          : schemaFakeAnswer(spec);
      } finally {
        await remote.close();
      }
    });
    return {
      id: backend.id,
      specificationVersion: backend.specificationVersion,
      capabilities: backend.capabilities,
      async validateTurn(_spec, _prompt, _id, native) {
        connection = native?.connection;
      },
      start: (spec) => backend.start(spec),
      resume: (id, spec) => backend.resume(id, spec),
    };
  };
}

export async function webResourceNative(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = join(root, "home");
    const project = join(root, "project");
    await mkdir(home);
    await mkdir(project);
    if (mode === "auto")
      await writeFile(join(home, "config.yaml"), "approvals:\n  resource: auto\n");
    const server = await startServer(home, nativeWebWorker(mode), {
      nativeTools: { command: process.execPath, args: [] },
    });
    try {
      const client = createRunClient(home);
      const workflow = vendorRecoveryWorkflow("complete");
      const continuation = mode === "approve" || mode === "deny";
      if (continuation) Object.assign(workflow.personas.worker, { request_turns: true });
      const run = await client.submit({
        project,
        workflow,
        backend: Backend.Fake,
        client_id: "native-web-test",
        submission_id: "native-web-fixture",
      });
      if (continuation) {
        assert.ok(
          await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Waiting),
        );
        const requests = createRequestClient(home);
        const pending = (await requests.list({ run_id: run.run_id })).requests[0]?.request;
        assert.ok(pending);
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: pending.request_id,
            version: pending.version,
            client_id: "native-web-test",
            reason: "Review fixture source",
            decision: mode === "approve" ? RequestDecision.Approve : RequestDecision.Deny,
          },
          ApprovalLevel.Main,
        );
        await client.control(run.run_id, RunAction.Resume);
      }
      const passed = await waitUntil(
        async () => (await client.get(run.run_id)).state === RunStatus.Passed,
      );
      if (!passed) assert.fail(JSON.stringify((await client.get(run.run_id)).nodes));
      return true;
    } finally {
      await server.stop();
    }
  });
}
