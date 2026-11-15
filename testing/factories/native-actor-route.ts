import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  Backend,
  ErrorCode,
  HttpMethod,
  LocalServer,
  NativeTool,
  ServerRoute,
} from "@titan/constants";
import { startServer } from "@titan/server";
import { call, callAsPerson } from "@titan/server/client";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type ClientAuthority, RunSnapshotSchema, ServerHealthSchema } from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function nativeActorRoute(actor: ClientAuthority, native: boolean) {
  return withTemporaryDirectory(async (home) => {
    await using resources = new AsyncDisposableStack();
    const project = resolve(home, "project");
    await mkdir(project);
    const server = await startServer(home, () => createFakeBackend());
    resources.defer(() => server.stop());
    const invoke = actor === ApprovalLevel.Human ? callAsPerson : call;
    const response = invoke(
      home,
      native ? NativeTool.Route : ServerRoute.Health,
      HttpMethod.Get,
      undefined,
    );
    if (native) await assert.rejects(response, { code: ErrorCode.PermissionDenied });
    else {
      assert.equal(ServerHealthSchema.parse(await response).ready, true);
      const run = RunSnapshotSchema.parse(
        await invoke(home, LocalServer.Runs, HttpMethod.Post, {
          project,
          workflow: checkedWorkflow(),
          backend: Backend.Fake,
          client_id: "native-actor-route",
          submission_id: "ordinary-operator",
        }),
      );
      assert.ok(run.run_id);
    }
    return true;
  });
}
