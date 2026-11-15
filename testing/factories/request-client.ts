import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  FileEncoding,
  LocalServer,
  RequestClientFixture,
  RequestDecision,
  RequestFormat,
  RequestKind,
  RequestLimit,
  RequestVersion,
  ServerCredential,
  ServerLimit,
} from "@titan/constants";
import { createRequestClient } from "@titan/server/requests";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { RequestAnswerSubmission } from "@titan/types";

function resource(): string {
  return "candidate";
}

export async function requestClientResponse(mode: RequestClientFixture) {
  return withTemporaryDirectory(async (home) => {
    const input = {
      request_id: "permission",
      kind: RequestKind.Tool,
      scope: {
        operation: "start",
        resource: resource(),
        content_hashes: {},
        arguments: [],
        environment_names: [],
      },
      origin: { client_id: "origin", harness_session_id: "session" },
      expires_at: 2000,
    };
    const answer: RequestAnswerSubmission = {
      run_id: "selected",
      request_id: input.request_id,
      version: RequestVersion.Open,
      decision: RequestDecision.Approve,
      reason: "Reviewed",
      client_id: "reviewer",
    };
    const human =
      mode === RequestClientFixture.Human || mode === RequestClientFixture.EscalatedAnswer;
    const record = {
      ...input,
      schema_version: RequestFormat.Legacy,
      run_id: answer.run_id,
      version: RequestVersion.Answered,
      level: ApprovalLevel.Main,
      created_at: 1000,
      answer: {
        decision: answer.decision,
        reason: answer.reason,
        actor: {
          client_id: answer.client_id,
          authority: human ? ApprovalLevel.Human : ApprovalLevel.Main,
        },
        decided_at: 1500,
      },
    };
    if ([RequestClientFixture.EscalatedRead, RequestClientFixture.EscalatedAnswer].includes(mode)) {
      answer.version = RequestVersion.Escalated;
      Reflect.set(record, "version", RequestVersion.EscalatedAnswered);
      record.level = ApprovalLevel.Human;
      record.answer.actor.authority = ApprovalLevel.Human;
      Reflect.set(record, "escalation", {
        reason: "Passed up",
        actor: { client_id: "main", authority: ApprovalLevel.Main },
        escalated_at: 1200,
      });
    }
    if (mode === RequestClientFixture.WrongReason) record.answer.reason = "changed";
    if (mode === RequestClientFixture.StaleResponse) {
      Reflect.set(record, "version", RequestVersion.Open);
      Reflect.set(record, "answer", null);
    }
    if (mode === RequestClientFixture.ObservedVersion) answer.version = RequestVersion.Answered;
    if (mode === RequestClientFixture.WrongRun) record.run_id = "other";
    if (mode === RequestClientFixture.WrongRequest) record.request_id = "other";
    if (mode === RequestClientFixture.ChangedScope) record.scope.resource = "changed";
    if (mode === RequestClientFixture.WrongDecision) record.answer.decision = RequestDecision.Deny;
    if (mode === RequestClientFixture.WrongActor) record.answer.actor.client_id = "other";
    if (mode === RequestClientFixture.WrongAuthority)
      record.answer.actor.authority = ApprovalLevel.Human;
    if (mode === RequestClientFixture.WrongVersion) Reflect.set(record, "version", 3);
    const agent = randomBytes(ServerCredential.RandomBytes).toString(FileEncoding.Hex);
    const person = randomBytes(ServerCredential.RandomBytes).toString(FileEncoding.Hex);
    let calls = 0;
    const server = Bun.serve({
      hostname: LocalServer.Host,
      port: 0,
      fetch(request) {
        calls++;
        assert.equal(
          request.headers.get("authorization"),
          LocalServer.Bearer + (human ? person : agent),
        );
        return Response.json(mode === RequestClientFixture.Malformed ? {} : record);
      },
    });
    await writeFile(
      resolve(home, LocalServer.File),
      Buffer.from(
        JSON.stringify({ url: `http://127.0.0.1:${server.port}`, token: agent, pid: process.pid }),
      ),
      { mode: ServerLimit.FileMode },
    );
    await writeFile(resolve(home, ServerCredential.PersonFile), Buffer.from(person), {
      mode: ServerLimit.FileMode,
    });
    const client = createRequestClient(home);
    const beforeTransport = [
      RequestClientFixture.InvalidOpen,
      RequestClientFixture.InvalidAnswer,
      RequestClientFixture.InvalidAuthority,
      RequestClientFixture.Oversized,
      RequestClientFixture.Accessor,
    ].includes(mode);
    try {
      if (
        mode === RequestClientFixture.Read ||
        mode === RequestClientFixture.EscalatedRead ||
        mode === RequestClientFixture.Malformed ||
        mode === RequestClientFixture.WrongRun ||
        mode === RequestClientFixture.WrongRequest
      )
        return Boolean(await client.get(answer.run_id, answer.request_id));
      if (mode === RequestClientFixture.Open || mode === RequestClientFixture.ChangedScope) {
        const expected = { ...input, scope: { ...input.scope, resource: "candidate" } };
        return Boolean(await client.open(answer.run_id, expected));
      }
      if (mode === RequestClientFixture.InvalidOpen) {
        Reflect.set(input, "kind", "unknown");
        return Boolean(await client.open(answer.run_id, input));
      }
      if (mode === RequestClientFixture.Oversized) {
        input.scope.resource = "x".repeat(RequestLimit.InputBytes);
        return Boolean(await client.open(answer.run_id, input));
      }
      if (mode === RequestClientFixture.Accessor) {
        Object.defineProperty(input.scope, "resource", { enumerable: true, get: resource });
        return Boolean(await client.open(answer.run_id, input));
      }
      if (mode === RequestClientFixture.InvalidAnswer) answer.reason = "";
      if (mode === RequestClientFixture.InvalidAuthority)
        return Boolean(await Reflect.apply(client.answer, client, [answer, ApprovalLevel.Auto]));
      return Boolean(await client.answer(answer, human ? ApprovalLevel.Human : ApprovalLevel.Main));
    } finally {
      assert.equal(calls, beforeTransport ? 0 : 1);
      await server.stop(true);
    }
  });
}
