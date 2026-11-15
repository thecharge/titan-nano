import { strict as assert } from "node:assert";
import {
  HttpHeader,
  HttpMethod,
  HttpOriginHeader,
  KnowledgeCommand,
  KnowledgeHttpFixture,
  KnowledgeKind,
  KnowledgeRoute,
  LocalServer,
} from "@titan/constants";
import { newId } from "@titan/core";
import { call, startServer } from "@titan/server";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { createFakeBackend } from "../support/backend.ts";
import { knowledgeDraft } from "./knowledge.ts";

export async function knowledgeHttp(mode: KnowledgeHttpFixture) {
  async function observe(home: string) {
    const server = await startServer(home, createFakeBackend);
    try {
      const client = createKnowledgeClient(home);
      const kind =
        mode === KnowledgeHttpFixture.Persona ? KnowledgeKind.Persona : KnowledgeKind.Fact;
      const original = await client.add(knowledgeDraft(kind));
      const id = original.entry.id;
      let body: unknown = { operation: KnowledgeCommand.Get, input: { id } };
      if (mode === KnowledgeHttpFixture.Search)
        body = { operation: KnowledgeCommand.Search, input: { question: "time zones" } };
      if (mode === KnowledgeHttpFixture.Malformed) body = "{";
      if (mode === KnowledgeHttpFixture.Invalid)
        body = { operation: KnowledgeCommand.Add, input: { ...knowledgeDraft(kind), extra: true } };
      if (mode === KnowledgeHttpFixture.Stale)
        body = { operation: KnowledgeCommand.Delete, input: { id, version: 2 } };
      if (mode === KnowledgeHttpFixture.Missing)
        body = { operation: KnowledgeCommand.Get, input: { id: newId() } };
      if (mode === KnowledgeHttpFixture.Persona)
        body = { operation: KnowledgeCommand.Delete, input: { id, version: 1 } };
      const headers = new Headers({
        [HttpHeader.Authorization]: LocalServer.Bearer + server.address.token,
        [HttpHeader.ContentType]: LocalServer.Json,
      });
      if (mode === KnowledgeHttpFixture.Unauthorized) headers.delete(HttpHeader.Authorization);
      if (mode === KnowledgeHttpFixture.Origin)
        headers.set(HttpOriginHeader, "https://example.com");
      const method = mode === KnowledgeHttpFixture.Method ? HttpMethod.Get : HttpMethod.Post;
      const path = KnowledgeRoute + (mode === KnowledgeHttpFixture.Query ? "?unexpected=1" : "");
      const response = await fetch(server.address.url + path, {
        method,
        headers,
        ...(method === HttpMethod.Get
          ? {}
          : { body: typeof body === "string" ? body : JSON.stringify(body) }),
      });
      assert.deepEqual(await client.get(id), original);
      const rebuilt = await call(home, KnowledgeRoute, HttpMethod.Post, {
        operation: KnowledgeCommand.Reindex,
        input: {},
      });
      assert.ok(rebuilt);
      return response.status;
    } finally {
      await server.stop();
    }
  }
  return withTemporaryDirectory(observe);
}
