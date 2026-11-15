import { strict as assert } from "node:assert";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  Backend,
  ErrorCode,
  ExitCode,
  HttpMethod,
  RequestCliFixture,
  RequestDecision,
  RequestKind,
  RequestLimit,
  RequestVersion,
  RunStatus,
  ServerCredential,
} from "@titan/constants";
import { requestAlreadyAnswered } from "@titan/messages";
import { call, startServer } from "@titan/server";
import { createRequestClient } from "@titan/server/requests";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { OperationRequestSchema, RunSnapshotSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function requestCli(mode: RequestCliFixture, flag = false, conflict = false) {
  return withTemporaryDirectory(async (directory) => {
    const home = resolve(directory, "home");
    const project = resolve(directory, "project");
    await mkdir(project);
    const factory = () => createFakeBackend();
    let server = await startServer(home, factory);
    try {
      const run = RunSnapshotSchema.parse(
        await call(home, "/runs", HttpMethod.Post, {
          project,
          workflow: checkedWorkflow(),
          backend: Backend.Fake,
          client_id: "cli-request",
          submission_id: "one",
        }),
      );
      assert.ok(
        await waitUntil(
          async () =>
            RunSnapshotSchema.parse(await call(home, `/runs/${run.run_id}`)).state ===
            RunStatus.Passed,
        ),
      );
      const client = createRequestClient(home);
      const person = [
        RequestCliFixture.PersonApprove,
        RequestCliFixture.PersonDeny,
        RequestCliFixture.MissingToken,
        RequestCliFixture.LinkedToken,
      ].includes(mode);
      const request = await client.open(run.run_id, {
        request_id: "permission",
        kind:
          person || mode === RequestCliFixture.HumanAgent ? RequestKind.Action : RequestKind.Tool,
        scope: {
          operation: "start",
          resource: "candidate",
          content_hashes: {},
          arguments: [],
          environment_names: [],
        },
        origin: { client_id: "origin", harness_session_id: "session" },
        expires_at: Date.now() + 60000,
      });
      const output: unknown[] = [];
      let accesses = 0;
      const cli = createCli({
        ...defaultServices,
        output: (value) => output.push(value),
        requests: (selected) => {
          accesses++;
          assert.equal(selected, home);
          return client;
        },
      });
      if (mode === RequestCliFixture.Reload) {
        await server.stop();
        server = await startServer(home, factory);
      }
      const deny = mode === RequestCliFixture.PersonDeny || mode === RequestCliFixture.AgentDeny;
      const reason = "Reviewed exact request";
      const args =
        mode === RequestCliFixture.Read
          ? ["requests", "show", run.run_id, request.request_id, "--home", home, "--json"]
          : [
              person ? (deny ? "deny" : "approve") : "answer",
              run.run_id,
              request.request_id,
              ...(person ? (deny ? [reason] : []) : [deny ? "deny" : "approve"]),
              "--home",
              home,
              "--json",
              "--request-version",
              "1",
              "--client-id",
              "reviewer",
              ...(!person || !deny ? ["--reason", reason] : []),
            ];
      if (flag) {
        args.splice(3, 1);
        args.splice(args.indexOf("--reason"), 2);
        args.push(deny ? "--deny" : "--yes", ...(deny ? [reason] : []));
        if (conflict && deny) args.splice(3, 0, "approve");
        if (conflict && !deny) args.push("--deny", reason);
      }
      if (mode === RequestCliFixture.MissingReason) args.splice(args.indexOf("--reason"), 2);
      if (mode === RequestCliFixture.LongReason)
        args[args.indexOf("--reason") + 1] = "x".repeat(RequestLimit.TextCharacters + 1);
      if (mode === RequestCliFixture.MissingVersion)
        args.splice(args.indexOf("--request-version"), 2);
      if (mode === RequestCliFixture.UnsafeVersion)
        args[args.indexOf("--request-version") + 1] = "9007199254740992";
      if (mode === RequestCliFixture.MissingClient) args.splice(args.indexOf("--client-id"), 2);
      if (mode === RequestCliFixture.BlankReason) args[args.indexOf("--reason") + 1] = "";
      if (mode === RequestCliFixture.BadRun) args[1] = "../escape";
      if (mode === RequestCliFixture.BadRequest) args[2] = "../escape";
      if (mode === RequestCliFixture.Stale) args[args.indexOf("--request-version") + 1] = "2";
      if (mode === RequestCliFixture.Repeated) {
        assert.equal(await cli(args), ExitCode.Success);
        output.length = 0;
      }
      if (mode === RequestCliFixture.MissingToken || mode === RequestCliFixture.LinkedToken) {
        const path = resolve(home, ServerCredential.PersonFile);
        const bytes = await readFileBytes(path, ServerCredential.FileBytes);
        await rm(path);
        if (mode === RequestCliFixture.LinkedToken) {
          const target = resolve(directory, "token-target");
          await writeFile(target, bytes, { mode: 0o600 });
          await symlink(target, path);
        }
      }
      try {
        assert.equal(await cli(args), ExitCode.Success);
        assert.equal(accesses, 1);
        assert.equal(output.length, 1);
        const observed = OperationRequestSchema.parse(output[0]);
        assert.deepEqual(await client.get(run.run_id, request.request_id), observed);
        if (mode === RequestCliFixture.Read) assert.deepEqual(observed, request);
        else {
          assert.equal(observed.version, RequestVersion.Answered);
          assert.equal(
            observed.answer?.decision,
            deny ? RequestDecision.Deny : RequestDecision.Approve,
          );
          assert.equal(
            observed.answer?.actor.authority,
            person ? ApprovalLevel.Human : ApprovalLevel.Main,
          );
          assert.equal(observed.answer?.actor.client_id, "reviewer");
        }
        return true;
      } catch (error) {
        const beforeAccess =
          (flag && conflict) ||
          [
            RequestCliFixture.MissingReason,
            RequestCliFixture.LongReason,
            RequestCliFixture.MissingVersion,
            RequestCliFixture.UnsafeVersion,
            RequestCliFixture.MissingClient,
            RequestCliFixture.BlankReason,
            RequestCliFixture.BadRun,
            RequestCliFixture.BadRequest,
          ].includes(mode);
        assert.equal(accesses, beforeAccess ? 0 : mode === RequestCliFixture.Repeated ? 2 : 1);
        assert.equal(output.length, 0);
        const observed = await client.get(run.run_id, request.request_id);
        assert.equal(
          observed.version,
          mode === RequestCliFixture.Repeated ? RequestVersion.Answered : RequestVersion.Open,
        );
        assert.equal(Reflect.get(Object(error), "exitCode"), ExitCode.Input);
        if (mode === RequestCliFixture.Repeated)
          assert.equal(
            Reflect.get(Object(error), "message"),
            requestAlreadyAnswered(request.request_id),
          );
        if (beforeAccess)
          assert.equal(
            Reflect.get(Object(error), "code"),
            mode === RequestCliFixture.BadRun || mode === RequestCliFixture.BadRequest
              ? ErrorCode.InvalidId
              : ErrorCode.Arguments,
          );
        throw error;
      }
    } finally {
      await server.stop();
    }
  });
}
