import {
  ApprovalLevel,
  CliCommand,
  ErrorCode,
  EventCursor,
  ExitCode,
  HttpMethod,
  LocalServer,
  RequestLimit,
  RequestOperation,
  RequestPageFormat,
  RequestPageLimit,
} from "@titan/constants";
import { assertSafeId, hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { RequestMessage } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";
import {
  ClientAuthoritySchema,
  type ClientConnector,
  type ClientRuntimeRecovery,
  type OperationRequest,
  OperationRequestInputSchema,
  OperationRequestSchema,
  RequestAnswerSubmissionSchema,
  type RequestClient,
  RequestEscalationSubmissionSchema,
  RequestPageSchema,
} from "@titan/types";
import { createClientTransport } from "./client.ts";
import { parseRequestListQuery } from "./request-listing.ts";

export { parseRequestListSearch } from "./request-listing.ts";

function admit(value: unknown): void {
  try {
    jsonByteLength(value, RequestLimit.InputBytes);
  } catch {
    throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
  }
}

function response(value: unknown, runId: string, requestId: string): OperationRequest {
  const parsed = OperationRequestSchema.safeParse(value);
  if (!parsed.success || parsed.data.run_id !== runId || parsed.data.request_id !== requestId)
    throw new TitanError(ErrorCode.InvalidResponse, RequestMessage.Client, ExitCode.Transport);
  return parsed.data;
}

function path(runId: string, requestId?: string): string {
  assertSafeId(runId);
  if (requestId !== undefined) assertSafeId(requestId);
  const run = [LocalServer.Runs, encodeURIComponent(runId), CliCommand.Requests].join(
    LocalServer.Root,
  );
  return requestId === undefined
    ? run
    : [run, encodeURIComponent(requestId)].join(LocalServer.Root);
}

export function createRequestClient(
  home: string,
  connect?: ClientConnector,
  recover?: ClientRuntimeRecovery,
): RequestClient {
  const call = createClientTransport(home, connect, false, recover);
  const person = createClientTransport(home, connect, true, recover);
  return {
    async escalate(input) {
      admit(input);
      const parsed = RequestEscalationSubmissionSchema.safeParse(input);
      if (!parsed.success) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
      const expected = parsed.data;
      const result = response(
        await call(
          [
            LocalServer.Root + CliCommand.Requests,
            encodeURIComponent(expected.request_id),
            RequestOperation.Escalate,
          ].join(LocalServer.Root),
          HttpMethod.Post,
          expected,
        ),
        expected.run_id,
        expected.request_id,
      );
      if (
        result.version !== expected.version + 1 ||
        result.level !== ApprovalLevel.Human ||
        result.answer !== null ||
        result.escalation?.reason !== expected.reason ||
        result.escalation.actor.client_id !== expected.client_id ||
        result.escalation.actor.authority !== ApprovalLevel.Main
      )
        throw new TitanError(ErrorCode.InvalidResponse, RequestMessage.Client, ExitCode.Transport);
      return result;
    },
    async list(input = {}) {
      const query = parseRequestListQuery(input);
      const search = new URLSearchParams(
        Object.entries(query).map(([key, value]) => [key, String(value)]),
      );
      const value = await call(RequestPageFormat.Route + EventCursor.Separator + search);
      try {
        jsonByteLength(value, RequestPageLimit.Bytes);
        const page = RequestPageSchema.parse(value);
        if (hash(JSON.stringify(page.query)) !== hash(JSON.stringify(query))) throw new Error();
        return page;
      } catch {
        throw new TitanError(ErrorCode.InvalidResponse, RequestMessage.Page, ExitCode.Transport);
      }
    },
    async open(runId, input) {
      admit(input);
      const parsed = OperationRequestInputSchema.safeParse(input);
      if (!parsed.success) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
      const result = response(
        await call(path(runId), HttpMethod.Post, parsed.data),
        runId,
        parsed.data.request_id,
      );
      const { request_id, kind, scope, origin, expires_at } = result;
      if (
        hash(JSON.stringify({ request_id, kind, scope, origin, expires_at })) !==
        hash(JSON.stringify(parsed.data))
      )
        throw new TitanError(ErrorCode.InvalidResponse, RequestMessage.Client, ExitCode.Transport);
      return result;
    },
    async get(runId, requestId) {
      return response(await call(path(runId, requestId)), runId, requestId);
    },
    async answer(input, authority) {
      admit(input);
      const parsed = RequestAnswerSubmissionSchema.safeParse(input);
      if (!parsed.success) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
      if (!ClientAuthoritySchema.safeParse(authority).success)
        throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
      const expected = parsed.data;
      const transport = authority === ApprovalLevel.Human ? person : call;
      const result = response(
        await transport(
          [
            LocalServer.Root + CliCommand.Requests,
            encodeURIComponent(expected.request_id),
            RequestOperation.Answer,
          ].join(LocalServer.Root),
          HttpMethod.Post,
          expected,
        ),
        expected.run_id,
        expected.request_id,
      );
      if (
        result.version !== expected.version + 1 ||
        result.answer?.decision !== expected.decision ||
        result.answer.reason !== expected.reason ||
        hash(JSON.stringify(result.answer.persona ?? null)) !==
          hash(JSON.stringify(expected.persona ?? null)) ||
        result.answer.actor.client_id !== expected.client_id ||
        result.answer.actor.authority !== authority
      )
        throw new TitanError(ErrorCode.InvalidResponse, RequestMessage.Client, ExitCode.Transport);
      return result;
    },
  };
}
