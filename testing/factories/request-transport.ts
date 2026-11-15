import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  Backend,
  FileEncoding,
  HttpHeader,
  HttpMethod,
  HttpStatus,
  IoLimit,
  LocalServer,
  RequestDecision,
  RequestKind,
  RequestTransportFixture,
  RequestVersion,
  RunEventKind,
  RunStatus,
  ServerCredential,
} from "@titan/constants";
import { all } from "@titan/core";
import { call, startServer } from "@titan/server";
import { createRequestClient } from "@titan/server/requests";
import { readBytes, readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { EventPageSchema, OperationRequestSchema, RunSnapshotSchema } from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function requestTransport(mode: RequestTransportFixture) {
  return withTemporaryDirectory(async (directory) => {
    const home = resolve(directory, "home");
    const project = resolve(directory, "project");
    await mkdir(project);
    const factory = () => createFakeBackend();
    let server = await startServer(home, factory);
    try {
      const person = (
        await readFileBytes(resolve(home, ServerCredential.PersonFile), ServerCredential.FileBytes)
      ).toString(FileEncoding.Utf8);
      const submit = async (submission: string) => {
        const run = RunSnapshotSchema.parse(
          await call(home, "/runs", HttpMethod.Post, {
            project,
            workflow: checkedWorkflow(),
            backend: Backend.Fake,
            client_id: "requests",
            submission_id: submission,
          }),
        );
        assert.ok(
          await waitUntil(
            async () =>
              RunSnapshotSchema.parse(await call(home, `/runs/${run.run_id}`)).state ===
              RunStatus.Passed,
          ),
        );
        return run.run_id;
      };
      const runId = await submit("first");
      const path = `/runs/${runId}/requests`;
      const send = async (route: string, method: HttpMethod, body?: unknown, human = false) => {
        const response = await fetch(server.address.url + route, {
          method,
          headers: {
            [HttpHeader.Authorization]:
              LocalServer.Bearer + (human ? person : server.address.token),
            [HttpHeader.ContentType]: LocalServer.Json,
          },
          ...(body === undefined
            ? {}
            : { body: typeof body === "string" ? body : JSON.stringify(body) }),
        });
        assert.ok(response.body);
        const value: unknown = JSON.parse(
          (await readBytes(response.body, IoLimit.ResponseBytes)).toString(FileEncoding.Utf8),
        );
        return { status: response.status, value };
      };
      const human = [RequestTransportFixture.Human, RequestTransportFixture.AgentHuman].includes(
        mode,
      );
      const input = {
        request_id: "permission",
        kind: human ? RequestKind.Action : RequestKind.Tool,
        scope: {
          operation: "start",
          resource: "fixture",
          content_hashes: {},
          arguments: [],
          environment_names: [],
        },
        origin: { client_id: "origin", harness_session_id: "session" },
        expires_at: Date.now() + (mode === RequestTransportFixture.Expired ? 1000 : 60000),
      };
      const opening = await send(path, HttpMethod.Post, input);
      assert.equal(opening.status, HttpStatus.Ok);
      const opened = OperationRequestSchema.parse(opening.value);
      assert.equal(opened.run_id, runId);
      const answer = {
        run_id: runId,
        request_id: input.request_id,
        version: RequestVersion.Open,
        decision:
          mode === RequestTransportFixture.Deny ? RequestDecision.Deny : RequestDecision.Approve,
        reason: "Reviewed exact scope",
        client_id: "answering-client",
      };
      if (
        [RequestTransportFixture.EscalatedApprove, RequestTransportFixture.EscalatedDeny].includes(
          mode,
        )
      ) {
        const client = createRequestClient(home);
        const { decision, ...escalation } = answer;
        const pending = await client.escalate(escalation);
        assert.equal(pending.answer, null);
        await server.stop();
        server = await startServer(home, factory);
        assert.deepEqual(await client.get(runId, input.request_id), pending);
        const decided = await client.answer(
          {
            ...answer,
            version: pending.version,
            decision:
              mode === RequestTransportFixture.EscalatedDeny ? RequestDecision.Deny : decision,
          },
          ApprovalLevel.Human,
        );
        assert.equal(decided.version, RequestVersion.EscalatedAnswered);
        assert.equal(
          decided.answer?.decision,
          mode === RequestTransportFixture.EscalatedDeny ? RequestDecision.Deny : decision,
        );
        assert.deepEqual(decided.escalation, pending.escalation);
        const events = EventPageSchema.parse(await call(home, `/runs/${runId}/events`));
        assert.equal(
          events.events.filter((event) => event.type === RunEventKind.RequestEscalated).length,
          1,
        );
        assert.equal(
          events.events.filter((event) => event.type === RunEventKind.RequestAnswered).length,
          1,
        );
        return HttpStatus.Ok;
      }
      const answerPath = `/requests/${input.request_id}/answer`;
      if (mode === RequestTransportFixture.Restart) {
        await server.stop();
        server = await startServer(home, factory);
        assert.deepEqual(
          OperationRequestSchema.parse(
            (await send(`${path}/${input.request_id}`, HttpMethod.Get)).value,
          ),
          opened,
        );
      }
      if (mode === RequestTransportFixture.Retry) {
        const retried = await send(path, HttpMethod.Post, input);
        assert.deepEqual(retried.value, opening.value);
      }
      let result: Awaited<ReturnType<typeof send>>;
      if (mode === RequestTransportFixture.Concurrent) {
        const results = await all(
          [
            () => send(answerPath, HttpMethod.Post, answer),
            () => send(answerPath, HttpMethod.Post, answer),
          ],
          2,
        );
        assert.deepEqual(results.map((entry) => entry.status).sort(), [
          HttpStatus.Ok,
          HttpStatus.Conflict,
        ]);
        const accepted = results.find((entry) => entry.status === HttpStatus.Ok);
        assert.ok(accepted);
        result = accepted;
      } else if (mode === RequestTransportFixture.Forged)
        result = await send(answerPath, HttpMethod.Post, {
          ...answer,
          authority: ApprovalLevel.Human,
        });
      else if (mode === RequestTransportFixture.Stale)
        result = await send(answerPath, HttpMethod.Post, {
          ...answer,
          version: RequestVersion.Answered,
        });
      else if (mode === RequestTransportFixture.Repeated) {
        assert.equal((await send(answerPath, HttpMethod.Post, answer)).status, HttpStatus.Ok);
        result = await send(answerPath, HttpMethod.Post, answer);
      } else if (mode === RequestTransportFixture.Changed)
        result = await send(path, HttpMethod.Post, {
          ...input,
          scope: { ...input.scope, resource: "changed" },
        });
      else if (mode === RequestTransportFixture.Missing)
        result = await send("/requests/absent/answer", HttpMethod.Post, {
          ...answer,
          request_id: "absent",
        });
      else if (mode === RequestTransportFixture.WrongRun) {
        const otherRun = await submit("second");
        const otherPath = `/runs/${otherRun}/requests`;
        const otherInput = { ...input, request_id: "other-permission" };
        const other = await send(otherPath, HttpMethod.Post, otherInput);
        assert.equal(other.status, HttpStatus.Ok);
        result = await send("/requests/other-permission/answer", HttpMethod.Post, {
          ...answer,
          request_id: "other-permission",
        });
        assert.deepEqual(
          (await send(`${otherPath}/other-permission`, HttpMethod.Get)).value,
          other.value,
        );
      } else if (mode === RequestTransportFixture.WrongPath)
        result = await send("/requests/absent/answer", HttpMethod.Post, answer);
      else if (mode === RequestTransportFixture.Expired) {
        await Bun.sleep(Math.max(0, opened.expires_at - Date.now() + 1));
        result = await send(answerPath, HttpMethod.Post, answer);
      } else if (mode === RequestTransportFixture.Query)
        result = await send(`${path}/${input.request_id}?limit=1`, HttpMethod.Get);
      else if (mode === RequestTransportFixture.Method)
        result = await send(answerPath, HttpMethod.Get);
      else if (mode === RequestTransportFixture.Malformed)
        result = await send(answerPath, HttpMethod.Post, "{");
      else if (mode === RequestTransportFixture.Invalid)
        result = await send(path, HttpMethod.Post, { ...input, scope: {} });
      else if (mode === RequestTransportFixture.Encoding)
        result = await send(`/runs/%ZZ/requests/permission`, HttpMethod.Get);
      else if (mode === RequestTransportFixture.ReadMissing)
        result = await send(`${path}/absent`, HttpMethod.Get);
      else
        result = await send(
          answerPath,
          HttpMethod.Post,
          answer,
          mode === RequestTransportFixture.Human,
        );
      const observed = OperationRequestSchema.parse(
        (await send(`${path}/${input.request_id}`, HttpMethod.Get)).value,
      );
      const answered = result.status === HttpStatus.Ok || mode === RequestTransportFixture.Repeated;
      assert.equal(observed.version, answered ? RequestVersion.Answered : RequestVersion.Open);
      if (answered) {
        assert.equal(observed.answer?.decision, answer.decision);
        assert.equal(observed.answer?.actor.client_id, answer.client_id);
        assert.equal(
          observed.answer?.actor.authority,
          mode === RequestTransportFixture.Human ? ApprovalLevel.Human : ApprovalLevel.Main,
        );
      } else assert.equal(observed.answer, null);
      const events = EventPageSchema.parse(await call(home, `/runs/${runId}/events`));
      assert.equal(
        events.events.filter((event) => event.type === RunEventKind.RequestOpened).length,
        1,
      );
      assert.equal(
        events.events.filter((event) => event.type === RunEventKind.RequestAnswered).length,
        answered ? 1 : 0,
      );
      return result.status;
    } finally {
      await server.stop();
    }
  });
}
