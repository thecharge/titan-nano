import { randomBytes } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  ErrorCode,
  FileEncoding,
  HttpHeader,
  HttpOriginHeader,
  HttpStatus,
  LocalServer,
  McpIdentity,
  NativeTool,
  NativeToolPolicy,
  NativeToolRole,
  ServerCredential,
  ServerLimit,
  StoreEviction,
} from "@titan/constants";
import { hash } from "@titan/core";
import { OperationalError, TitanError } from "@titan/errors";
import type { KnowledgeHub } from "@titan/knowledge";
import { NativeToolMessage, WebResourceMessage } from "@titan/messages";
import { BoundedStore, KeyedQueue } from "@titan/store";
import {
  type KnowledgeNativeHub,
  NativeFileChangeSchema,
  type NativeFileLister,
  NativeFileListSelectionSchema,
  type NativeFileReader,
  NativeFileSelectionSchema,
  type NativeFileWriter,
  type NativeKnowledgeRouter,
  type NativeToolAuditWriter,
  type NativeToolCurrent,
  type NativeToolLease,
  type NativeToolRegistration,
  NativeToolScopeSchema,
  type NativeToolSettings,
  NativeToolSettingsSchema,
  type NativeWebReader,
  WebResourceSelectionSchema,
} from "@titan/types";
import { nativeCallName, nativeCallRecord } from "./native-audit.ts";
import {
  nativeToolOperation,
  nativeToolResult,
  registerNativeKnowledge,
} from "./native-knowledge.ts";

export class NativeToolAuthority {
  private bindings;
  private queue;
  private closing = false;

  constructor(
    private knowledge: KnowledgeHub,
    input: NativeToolSettings,
    private audit: NativeToolAuditWriter,
    private route?: NativeKnowledgeRouter,
    private readFile?: NativeFileReader,
    private listFiles?: NativeFileLister,
    private writeFile?: NativeFileWriter,
    private readWeb?: NativeWebReader,
  ) {
    const settings = NativeToolSettingsSchema.parse(input);
    this.bindings = new BoundedStore<string, NativeToolRegistration>({
      maxEntries: settings.max_bindings,
      eviction: StoreEviction.Reject,
    });
    this.queue = new KeyedQueue(settings.max_pending_operations);
  }

  open(input: unknown, current: NativeToolCurrent): NativeToolLease {
    const parsed = NativeToolScopeSchema.safeParse(input);
    if (!parsed.success) throw new TitanError(ErrorCode.Arguments, NativeToolMessage.Invalid);
    if (this.closing || !current()) this.denied();
    const token = randomBytes(ServerCredential.RandomBytes).toString(FileEncoding.Hex);
    const key = hash(token);
    const binding = { scope: parsed.data, current, closing: false, failed: false };
    this.bindings.set(key, binding);
    return {
      token,
      tools: [...NativeToolPolicy[parsed.data.role]],
      guard: () => this.healthy(binding),
      close: async () => {
        await this.revoke(key);
        this.healthy(binding);
      },
    };
  }

  private denied(): never {
    throw new TitanError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
  }

  private revoke(key: string): Promise<void> {
    const binding = this.bindings.get(key);
    if (!binding) return Promise.resolve();
    binding.closing = true;
    binding.stopping ??= this.drain(key);
    return binding.stopping;
  }

  private async drain(key: string): Promise<void> {
    await this.queue.drain(key);
    this.bindings.delete(key);
  }

  async close(): Promise<void> {
    this.closing = true;
    for (const key of this.bindings.keys()) await this.revoke(key);
  }

  async respond(request: Request): Promise<Response> {
    try {
      if (
        this.closing ||
        request.headers.has(HttpOriginHeader) ||
        new URL(request.url).pathname !== NativeTool.Route
      )
        this.denied();
      const authorization = request.headers.get(HttpHeader.Authorization);
      if (!authorization?.startsWith(LocalServer.Bearer)) this.denied();
      const key = hash(authorization.slice(LocalServer.Bearer.length));
      const binding = this.bindings.get(key);
      if (!binding || binding.closing || !binding.current()) this.denied();
      return await this.queue.use(key, async () => {
        this.available(binding);
        return this.audited(request, binding);
      });
    } catch (error) {
      return this.failure(error);
    }
  }

  private failure(error: unknown): Response {
    if (error instanceof TitanError && error.code === ErrorCode.PermissionDenied)
      return Response.json(
        { code: ErrorCode.PermissionDenied, error: NativeToolMessage.Denied },
        { status: HttpStatus.Forbidden },
      );
    if (error instanceof OperationalError && error.code === ErrorCode.Capacity)
      return Response.json(
        { code: ErrorCode.Capacity, error: NativeToolMessage.Unavailable },
        { status: HttpStatus.Conflict },
      );
    return Response.json(
      { code: ErrorCode.ServerUnavailable, error: NativeToolMessage.Unavailable },
      { status: HttpStatus.Internal },
    );
  }

  private available(binding: NativeToolRegistration): void {
    this.healthy(binding);
    if (binding.closing || !binding.current()) this.denied();
  }

  private healthy(binding: NativeToolRegistration): void {
    if (binding.failed) throw new TitanError(ErrorCode.DurableWrite, NativeToolMessage.Audit);
  }

  private async audited(request: Request, binding: NativeToolRegistration): Promise<Response> {
    const tool = await nativeCallName(request);
    if (tool === undefined) return this.response(request, binding);
    try {
      const response = await this.response(request, binding);
      await this.audit(binding.scope, await nativeCallRecord(tool, response));
      return response;
    } catch {
      binding.failed = true;
      throw new TitanError(ErrorCode.DurableWrite, NativeToolMessage.Audit);
    }
  }

  private async response(request: Request, binding: NativeToolRegistration): Promise<Response> {
    if (binding.scope.role !== NativeToolRole.Improver && this.route)
      return this.route(binding.scope, (hub) => this.knowledgeResponse(request, binding, hub));
    return this.knowledgeResponse(request, binding, this.knowledge);
  }

  private async knowledgeResponse(
    request: Request,
    binding: NativeToolRegistration,
    hub: KnowledgeNativeHub,
  ): Promise<Response> {
    this.available(binding);
    await using resources = new AsyncDisposableStack();
    const server = new McpServer({ name: McpIdentity.Name, version: McpIdentity.Version });
    resources.defer(() => server.close());
    if (binding.scope.role !== NativeToolRole.Improver) {
      registerNativeKnowledge(server, hub, binding.scope);
      server.registerTool(
        NativeTool.ListFiles,
        { description: NativeToolMessage.ListFiles, inputSchema: NativeFileListSelectionSchema },
        async ({ directory }) =>
          nativeToolOperation(async () => {
            if (!this.listFiles)
              throw new TitanError(ErrorCode.ServerUnavailable, NativeToolMessage.Unavailable);
            return this.listFiles(binding.scope, directory);
          }),
      );
    }
    server.registerTool(
      NativeTool.ReadFile,
      { description: NativeToolMessage.ReadFile, inputSchema: NativeFileSelectionSchema },
      async ({ path }) =>
        nativeToolOperation(async () => {
          if (!this.readFile)
            throw new TitanError(ErrorCode.ServerUnavailable, NativeToolMessage.Unavailable);
          return this.readFile(binding.scope, path);
        }),
    );
    if (binding.scope.role === NativeToolRole.Worker)
      server.registerTool(
        NativeTool.WriteFile,
        { description: NativeToolMessage.WriteFile, inputSchema: NativeFileChangeSchema },
        async (change) =>
          nativeToolOperation(async () => {
            if (!this.writeFile)
              throw new TitanError(ErrorCode.ServerUnavailable, NativeToolMessage.Unavailable);
            return this.writeFile(binding.scope, change);
          }),
      );
    if (binding.scope.role === NativeToolRole.Worker)
      server.registerTool(
        NativeTool.ReadWeb,
        {
          description: WebResourceMessage.Description,
          inputSchema: WebResourceSelectionSchema,
        },
        async ({ url, request_id }) =>
          nativeToolOperation(async () => {
            if (!this.readWeb)
              throw new TitanError(ErrorCode.ServerUnavailable, NativeToolMessage.Unavailable);
            return this.readWeb(binding.scope, url, request_id);
          }),
      );
    server.registerTool(
      NativeTool.Ready,
      { description: NativeToolMessage.Ready, inputSchema: {} },
      async () =>
        nativeToolResult({
          schema_version: NativeTool.Version,
          ...binding.scope,
          tools: [...NativeToolPolicy[binding.scope.role]],
        }),
    );
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      maxRequestBodySize: ServerLimit.RequestBytes,
    });
    await server.connect(transport);
    return await transport.handleRequest(request);
  }
}
