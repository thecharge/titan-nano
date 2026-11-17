import { resolve } from "node:path";
import { readRunConfiguration } from "@titan/config";
import {
  CliCommand,
  CliOption,
  ErrorCode,
  EventCursor,
  ExitCode,
  FileEncoding,
  HttpHeader,
  HttpMethod,
  IoLimit,
  LocalServer,
  ServerLimit,
  TextSymbol,
  UsageLimit,
} from "@titan/constants";
import { hash } from "@titan/core";
import { RunRuntimeError, TitanError } from "@titan/errors";
import {
  ArtifactMessage,
  ServerMessage,
  TransportMessage,
  unsupportedBackend,
} from "@titan/messages";
import { readBytes, readFileBytes } from "@titan/streams";
import {
  type Address,
  AddressSchema,
  ArtifactInspectionSchema,
  ArtifactPageSchema,
  ArtifactQuerySchema,
  type ClientConnector,
  type ClientRuntimeRecovery,
  type ClientTransport,
  CompactRunSchema,
  EventPageSchema,
  EventQuerySchema,
  EventSearchSchema,
  ResumeBackendSchema,
  type RunClient,
  RunListQuerySchema,
  RunListSearchSchema,
  RunPageSchema,
  RunSnapshotSchema,
  RunUsageSchema,
  ServerErrorSchema,
} from "@titan/types";
import { readPersonToken } from "./credentials.ts";

export function parseEventSearch(value: unknown) {
  const result = EventSearchSchema.safeParse(value);
  if (!result.success) throw new TitanError(ErrorCode.Arguments, ServerMessage.EventQuery);
  return result.data;
}

export function parseResumeBackend(value: string | null) {
  const result = ResumeBackendSchema.safeParse(value ?? undefined);
  if (!result.success)
    throw new TitanError(ErrorCode.Backend, unsupportedBackend(value ?? TextSymbol.Empty));
  return result.data;
}

export function parseRunListSearch(value: unknown) {
  const result = RunListSearchSchema.safeParse(value);
  if (!result.success) throw new TitanError(ErrorCode.Arguments, ServerMessage.RunQuery);
  return result.data;
}

export async function readAddress(home: string): Promise<Address> {
  try {
    return AddressSchema.parse(
      JSON.parse(
        (await readFileBytes(resolve(home, LocalServer.File), IoLimit.AddressBytes)).toString(
          FileEncoding.Utf8,
        ),
      ),
    );
  } catch {
    throw new TitanError(
      ErrorCode.ServerUnavailable,
      TransportMessage.StartServer,
      ExitCode.Transport,
    );
  }
}

async function fetchServer(
  address: Address,
  path: string,
  method: string,
  body: unknown,
): Promise<Response> {
  try {
    return await fetch(address.url + path, {
      method,
      headers: {
        [HttpHeader.Authorization]: LocalServer.Bearer + address.token,
        [HttpHeader.ContentType]: LocalServer.Json,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(LocalServer.TimeoutMilliseconds),
    });
  } catch {
    throw new TitanError(
      ErrorCode.ServerUnavailable,
      TransportMessage.Unavailable,
      ExitCode.Transport,
    );
  }
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    const bytes = response.body
      ? await readBytes(response.body, IoLimit.ResponseBytes)
      : Buffer.alloc(0);
    return JSON.parse(bytes.toString(FileEncoding.Utf8));
  } catch {
    throw new TitanError(
      ErrorCode.InvalidResponse,
      TransportMessage.InvalidJson,
      ExitCode.Transport,
    );
  }
}

async function callAddress(
  address: Address,
  path: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetchServer(address, path, method, body);
  const result = await responseBody(response);
  if (response.ok) return result;
  const info = ServerErrorSchema.safeParse(result);
  if (!info.success)
    throw new TitanError(
      ErrorCode.InvalidResponse,
      TransportMessage.InvalidError,
      ExitCode.Transport,
    );
  const exitCode =
    response.status === LocalServer.UnauthorizedStatus ? ExitCode.Transport : ExitCode.Input;
  if (info.data.code === ErrorCode.UnsupportedRunRuntime && info.data.required_runtime)
    throw new RunRuntimeError(
      info.data.required_runtime,
      info.data.error,
      info.data.required_build,
    );
  throw new TitanError(info.data.code, info.data.error, exitCode);
}

export async function call(
  home: string,
  path: string,
  method: string = HttpMethod.Get,
  body?: unknown,
): Promise<unknown> {
  return callAddress(await readAddress(home), path, method, body);
}

export async function callAsPerson(
  home: string,
  path: string,
  method: string,
  body: unknown,
): Promise<unknown> {
  const address = await readAddress(home);
  return callAddress({ ...address, token: await readPersonToken(home) }, path, method, body);
}

function parseRun(value: unknown, id?: string, compact = false) {
  const result = (compact ? CompactRunSchema : RunSnapshotSchema).safeParse(value);
  if (!result.success || (id !== undefined && result.data.run_id !== id))
    throw new TitanError(
      ErrorCode.InvalidResponse,
      TransportMessage.InvalidRun,
      ExitCode.Transport,
    );
  return result.data;
}

export function createClientTransport(
  home: string,
  connect?: ClientConnector,
  person = false,
  recover?: ClientRuntimeRecovery,
): ClientTransport {
  return async (path, method = HttpMethod.Get, body) => {
    await connect?.();
    const request = () =>
      person ? callAsPerson(home, path, method, body) : call(home, path, method, body);
    try {
      return await request();
    } catch (error) {
      if (
        !(error instanceof RunRuntimeError) ||
        !(await recover?.(error.requiredRuntime, error.requiredBuild))
      )
        throw error;
      return request();
    }
  };
}

export function createRunClient(
  home: string,
  connect?: ClientConnector,
  recover?: ClientRuntimeRecovery,
): RunClient {
  const request = createClientTransport(home, connect, false, recover);
  const runPath = (id: string): string =>
    [LocalServer.Runs, encodeURIComponent(id)].join(LocalServer.Root);
  return {
    async configuration(id) {
      return readRunConfiguration(
        await request([runPath(id), CliCommand.Config].join(LocalServer.Root)),
        id,
      );
    },
    async usage(id) {
      const parsed = RunUsageSchema.safeParse(
        await request([runPath(id), CliCommand.Usage].join(LocalServer.Root)),
      );
      if (!parsed.success || parsed.data.run_id !== id)
        throw new TitanError(
          ErrorCode.InvalidResponse,
          TransportMessage.InvalidUsage,
          ExitCode.Transport,
        );
      return parsed.data;
    },
    async artifact(id, file, query = {}) {
      const expected = ArtifactQuerySchema.parse(query);
      const parameters = new URLSearchParams(
        Object.entries(expected).map(([key, value]) => [key, String(value)]),
      );
      const result = ArtifactPageSchema.safeParse(
        await request(
          [runPath(id), LocalServer.Artifacts, encodeURIComponent(file)].join(LocalServer.Root) +
            EventCursor.Separator +
            parameters,
        ),
      );
      if (
        !result.success ||
        result.data.run_id !== id ||
        result.data.file.id !== file ||
        result.data.file.id !== hash(result.data.file.path) ||
        result.data.offset !== expected.offset ||
        result.data.next_offset - result.data.offset > expected.limit
      )
        throw new TitanError(ErrorCode.InvalidResponse, ArtifactMessage.Page, ExitCode.Transport);
      return result.data;
    },
    async artifacts(id) {
      const parsed = ArtifactInspectionSchema.safeParse(
        await request([runPath(id), LocalServer.Artifacts].join(LocalServer.Root)),
      );
      if (!parsed.success || parsed.data.run_id !== id)
        throw new TitanError(ErrorCode.InvalidResponse, ArtifactMessage.Client, ExitCode.Transport);
      return parsed.data;
    },
    async get(id, compact = false) {
      const path = compact
        ? runPath(id) +
          EventCursor.Separator +
          new URLSearchParams({ [CliOption.Compact]: String(true) })
        : runPath(id);
      return parseRun(await request(path), id, compact);
    },
    async submit(body) {
      return parseRun(await request(LocalServer.Runs, HttpMethod.Post, body));
    },
    async control(id, action, backend) {
      const parameters = new URLSearchParams(
        backend === undefined ? [] : [[UsageLimit.Query, backend]],
      );
      return parseRun(
        await request(
          [runPath(id), action].join(LocalServer.Root) + EventCursor.Separator + parameters,
          HttpMethod.Post,
          {},
        ),
        id,
      );
    },
    async list(query = {}) {
      const expected = RunListQuerySchema.parse(query);
      const parameters = new URLSearchParams(
        Object.entries(expected)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)]),
      );
      const result = RunPageSchema.safeParse(
        await request(LocalServer.Runs + EventCursor.Separator + parameters),
      );
      if (
        !result.success ||
        result.data.before !== expected.before ||
        result.data.schema_version !==
          (expected.harness_session_id !== undefined ||
          expected.project_path !== undefined ||
          expected.state !== undefined
            ? ServerLimit.FilteredRunPageVersion
            : ServerLimit.RunPageVersion) ||
        result.data.runs.length > expected.limit ||
        (expected.harness_session_id !== undefined &&
          result.data.runs.some((run) => run.harness_session_id !== expected.harness_session_id)) ||
        (expected.project_path !== undefined &&
          result.data.runs.some((run) => run.project !== expected.project_path)) ||
        (expected.state !== undefined &&
          result.data.runs.some((run) => run.state !== expected.state)) ||
        (expected.client_id !== undefined &&
          result.data.runs.some((run) => run.client_id !== expected.client_id))
      )
        throw new TitanError(ErrorCode.InvalidResponse, ServerMessage.RunPage, ExitCode.Transport);
      return result.data;
    },
    async events(id, query = {}) {
      const expected = EventQuerySchema.parse(query);
      const parameters = new URLSearchParams(
        Object.entries(expected).map(([key, value]) => [key, String(value)]),
      );
      const result = EventPageSchema.safeParse(
        await request(
          [runPath(id), LocalServer.Events].join(LocalServer.Root) +
            EventCursor.Separator +
            parameters,
        ),
      );
      if (
        !result.success ||
        result.data.run_id !== id ||
        result.data.after !== expected.after ||
        result.data.events.length > expected.limit
      )
        throw new TitanError(
          ErrorCode.InvalidResponse,
          TransportMessage.InvalidEvents,
          ExitCode.Transport,
        );
      return result.data;
    },
  };
}

export { parseArtifactSearch } from "@titan/artifacts";
