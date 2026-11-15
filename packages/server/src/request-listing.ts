import {
  ErrorCode,
  RequestLimit,
  RequestPageFormat,
  RequestPageLimit,
  RequestPageSql,
  RequestState,
  ServerSql,
  ServerState,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { RequestMessage } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";
import {
  type OperationRequest,
  type RequestCursor,
  RequestCursorSchema,
  type RequestListQuery,
  RequestListQuerySchema,
  type RequestListRun,
  RequestListSearchSchema,
  type RequestPage,
  type RequestPageItem,
  RequestPageItemSchema,
  RequestPageSchema,
  type RequestPageSource,
  type RequestUnavailable,
  type StoredCatalog,
  StoredCatalogSchema,
} from "@titan/types";

export function parseRequestListQuery(value: unknown): RequestListQuery {
  try {
    jsonByteLength(value, RequestPageLimit.QueryBytes);
    return RequestListQuerySchema.parse(value);
  } catch {
    throw new TitanError(ErrorCode.Arguments, RequestMessage.PageQuery);
  }
}

export function parseRequestListSearch(value: unknown): RequestListQuery {
  try {
    jsonByteLength(value, RequestPageLimit.QueryBytes);
    return RequestListSearchSchema.parse(value);
  } catch {
    throw new TitanError(ErrorCode.Arguments, RequestMessage.PageQuery);
  }
}

function filters(query: RequestListQuery): string {
  const { cursor, limit, ...selection } = query;
  return hash(JSON.stringify(selection));
}

function cursor(query: RequestListQuery): RequestCursor {
  const expected = filters(query);
  if (query.cursor === undefined)
    return { before: Number.MAX_SAFE_INTEGER, run_id: null, after: null, filters: expected };
  try {
    const bytes = Buffer.from(query.cursor, RequestPageFormat.CursorEncoding);
    if (bytes.toString(RequestPageFormat.CursorEncoding) !== query.cursor) throw new Error();
    const selected = RequestCursorSchema.parse(JSON.parse(bytes.toString()));
    if (selected.filters !== expected) throw new Error();
    return selected;
  } catch {
    throw new TitanError(ErrorCode.Arguments, RequestMessage.PageQuery);
  }
}

function matches(request: OperationRequest, query: RequestListQuery): boolean {
  return (
    (query.client_id === undefined || request.origin.client_id === query.client_id) &&
    (query.harness_session_id === undefined ||
      request.origin.harness_session_id === query.harness_session_id) &&
    (query.state === undefined ||
      (request.answer === null ? RequestState.Waiting : RequestState.Answered) === query.state)
  );
}

async function read(
  source: RequestPageSource,
  row: StoredCatalog,
  query: RequestListQuery,
): Promise<RequestListRun | null> {
  try {
    const run = await source.read(row, query.project_path);
    if (run.requests.length > RequestLimit.PerRun)
      throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
    for (const request of run.requests) {
      validateRequestIdentity(request, row.id);
    }
    RequestPageItemSchema.shape.project_path.parse(run.project_path);
    return run;
  } catch {
    return null;
  }
}

function validateRequestIdentity(request: OperationRequest, runId: string): void {
  jsonByteLength(request, RequestLimit.InputBytes);
  if (request.run_id !== runId)
    throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
}

function page(
  query: RequestListQuery,
  requests: RequestPageItem[],
  unavailable: RequestUnavailable[],
  next: RequestCursor | null,
): RequestPage {
  const value = {
    schema_version: RequestPageLimit.Version,
    query,
    requests,
    unavailable,
    next_cursor:
      next === null
        ? null
        : Buffer.from(JSON.stringify(next)).toString(RequestPageFormat.CursorEncoding),
    has_more: next !== null,
  };
  jsonByteLength(value, RequestPageLimit.Bytes);
  return RequestPageSchema.parse(value);
}

export async function listRequests(
  source: RequestPageSource,
  input: unknown,
): Promise<RequestPage> {
  const query = parseRequestListQuery(input);
  const position = cursor(query);
  const rows = StoredCatalogSchema.array()
    .max(RequestPageLimit.Runs + 1)
    .parse(
      await source.database.unsafe(
        query.run_id === undefined ? ServerSql.List : RequestPageSql.Run,
        query.run_id === undefined
          ? [position.before, RequestPageLimit.Runs + 1]
          : [query.run_id, position.before],
      ),
    );
  if (position.run_id !== null && rows[0]?.id !== position.run_id)
    throw new TitanError(ErrorCode.Arguments, RequestMessage.PageQuery);
  const requests: RequestPageItem[] = [];
  const unavailable: RequestUnavailable[] = [];
  let bytes = RequestPageLimit.EnvelopeBytes;
  let before = position.before;
  const appendRunRequests = (run: RequestListRun, row: StoredCatalog): RequestPage | null => {
    const after = row.id === position.run_id ? position.after : null;
    if (after !== null && !run.requests.some((request) => request.request_id === after))
      throw new TitanError(ErrorCode.Arguments, RequestMessage.PageQuery);
    const selected = run.requests
      .filter(
        (request) => matches(request, query) && (after === null || request.request_id > after),
      )
      .sort((left, right) =>
        left.request_id < right.request_id ? -1 : left.request_id > right.request_id ? 1 : 0,
      );
    let last = after;
    for (const request of selected) {
      const item = { project_path: run.project_path, request };
      const size = jsonByteLength(item, RequestPageLimit.Bytes) + 1;
      if (requests.length === query.limit || bytes + size > RequestPageLimit.Bytes) {
        return page(query, requests, unavailable, {
          before: row.sequence + 1,
          run_id: row.id,
          after: last,
          filters: position.filters,
        });
      }
      requests.push(item);
      bytes += size;
      last = request.request_id;
    }
    return null;
  };
  for (const row of rows.slice(0, RequestPageLimit.Runs)) {
    const run = await read(source, row, query);
    before = row.sequence;
    if (run === null) {
      unavailable.push({
        run_id: row.id,
        client_id: row.client_id,
        state: ServerState.ReadUnavailable,
      });
      continue;
    }
    if (query.project_path !== undefined && run.project_path !== query.project_path) continue;
    const full = appendRunRequests(run, row);
    if (full !== null) return full;
  }
  const next =
    rows.length > RequestPageLimit.Runs
      ? { before, run_id: null, after: null, filters: position.filters }
      : null;
  return page(query, requests, unavailable, next);
}
