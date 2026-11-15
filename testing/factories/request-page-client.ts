import { strict as assert } from "node:assert";
import {
  ApprovalLevel,
  RequestDecision,
  RequestPageClientFixture,
  RequestPageLimit,
  RequestState,
  RequestVersion,
} from "@titan/constants";
import { createRequestClient } from "@titan/server/requests";
import { type RequestListQueryInput, type RequestPage, RequestPageSchema } from "@titan/types";
import { withClientAddress } from "../support/client.ts";
import { requestPageRecord } from "./request-pages.ts";

export async function requestPageClient(mode: RequestPageClientFixture) {
  let reads = 0;
  const limit = () => {
    reads++;
    return 1;
  };
  const query: RequestListQueryInput = {
    limit: limit(),
    run_id: "selected",
    client_id: "codex",
    harness_session_id: "session-a",
    project_path: "/project",
    state: RequestState.Waiting,
  };
  const page: RequestPage = RequestPageSchema.parse({
    schema_version: RequestPageLimit.Version,
    query,
    requests: [{ project_path: "/project", request: requestPageRecord("selected", "permission") }],
    unavailable: [],
    next_cursor: null,
    has_more: false,
  });
  const item = page.requests[0];
  assert.ok(item);
  if (mode === RequestPageClientFixture.Empty) page.requests = [];
  if (mode === RequestPageClientFixture.Query) page.query.limit = 2;
  if (mode === RequestPageClientFixture.Caller) item.request.origin.client_id = "other";
  if (mode === RequestPageClientFixture.Session) item.request.origin.harness_session_id = "other";
  if (mode === RequestPageClientFixture.Project) item.project_path = "/other";
  if (mode === RequestPageClientFixture.Run) item.request.run_id = "other";
  if (mode === RequestPageClientFixture.State) {
    item.request.version = RequestVersion.Answered;
    item.request.answer = {
      decision: RequestDecision.Approve,
      reason: "Reviewed",
      actor: { authority: ApprovalLevel.Main, client_id: "reviewer" },
      decided_at: 1500,
    };
  }
  if (mode === RequestPageClientFixture.Count)
    page.requests.push({ ...item, request: { ...item.request, request_id: "second" } });
  if (mode === RequestPageClientFixture.Duplicate) {
    query.limit = 2;
    page.query.limit = 2;
    page.requests.push(item);
  }
  if (mode === RequestPageClientFixture.Cursor) {
    query.cursor = "opaque";
    page.query.cursor = "opaque";
    page.next_cursor = "opaque";
    page.has_more = true;
  }
  if (mode === RequestPageClientFixture.Bytes) {
    query.limit = 100;
    page.query.limit = 100;
    page.requests = Array.from({ length: 3 }, (_, index) => ({
      ...item,
      request: {
        ...item.request,
        request_id: `request-${index}`,
        scope: {
          ...item.request.scope,
          arguments: Array.from({ length: 24 }, () => "\0".repeat(2800)),
        },
      },
    }));
  }
  if (mode === RequestPageClientFixture.Input) query.limit = 0;
  if (mode === RequestPageClientFixture.Accessor)
    Object.defineProperty(query, "limit", { enumerable: true, get: limit });
  try {
    return await withClientAddress(
      Response.json(mode === RequestPageClientFixture.Malformed ? {} : page),
      async (home) => Boolean(await createRequestClient(home).list(query)),
    );
  } finally {
    assert.equal(reads, 1);
  }
}
