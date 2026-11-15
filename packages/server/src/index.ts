import { chmod, mkdir, realpath, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectArtifacts, parseArtifactSearch, readArtifact } from "@titan/artifacts";
import { atomicWrite, RunStore, runProofSummary } from "@titan/board";
import { describeRunConfiguration, resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  BoardFile,
  CliCommand,
  DashboardHeader,
  DashboardPolicy,
  DashboardRoute,
  EmbeddedRuntimeBuild,
  ErrorCode,
  FileReconciliation,
  HttpHeader,
  HttpMethod,
  HttpOriginHeader,
  HttpStatus,
  KnowledgeRoute,
  KnowledgeScope,
  LocalServer,
  LogEvent,
  LogLevel,
  McpIdentity,
  NativeTool,
  RequestOperation,
  RequestPageFormat,
  RunAction,
  RunFormat,
  RunStatus,
  RuntimeLimit,
  ScriptExecution,
  ServerCode,
  ServerDatabaseAdapter,
  ServerFile,
  ServerLimit,
  ServerRoute,
  ServerRuntimePaths,
  ServerSql,
  UsageLimit,
} from "@titan/constants";
import { isActiveRun, newId, settle } from "@titan/core";
import { errorMessage, RunRuntimeError, TitanError } from "@titan/errors";
import {
  inspectKnowledge,
  inspectPendingKnowledge,
  KnowledgeHub,
  localMeaning,
  nativeRunKnowledge,
  ownedKnowledge,
  projectHubHome,
  ScopedKnowledgeHub,
  selectEmbedder,
} from "@titan/knowledge";
import { createLogger } from "@titan/logger";
import {
  CredentialMessage,
  DashboardMessage,
  localServerUrl,
  ServerMessage,
} from "@titan/messages";
import { Engine } from "@titan/runner";
import { KeyedQueue } from "@titan/store";
import type {
  BackendFactory,
  ClientAuthority,
  KnowledgeSettingsInput,
  ReadStoredRun,
  ServerOptions,
} from "@titan/types";
import {
  ArtifactHashSchema,
  type ServerHandle,
  ServerStopRequestSchema,
  StoredRootSchema,
  StoredRunSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";

import { ServerAdmission } from "./admission.ts";
import { observeRun } from "./background.ts";
import { parseEventSearch, parseResumeBackend, parseRunListSearch } from "./client.ts";
import { authenticate, personToken } from "./credentials.ts";
import { Dashboard } from "./dashboard.ts";
import { dashboardSource } from "./dashboard-source.ts";
import { cursorOf, eventBody } from "./event-stream.ts";
import { knowledgeResponse } from "./knowledge.ts";
import {
  cachedRunNumbers,
  cachedRunSummary,
  describeRun,
  listRuns,
  RunSummaryProjector,
  summaryStamp,
  writeRunSummary,
} from "./listing.ts";
import { assertUpdateSettled, ownMaintenance } from "./maintenance.ts";
import { NativeExecutions } from "./native-executions.ts";
import { NativeToolAuthority } from "./native-tools.ts";
import { ownServer } from "./ownership.ts";
import { listRequests, parseRequestListSearch } from "./request-listing.ts";
import { operateRequest, selectRequest } from "./requests.ts";
import { scopedScripts } from "./scripts.ts";
import { RunSubmissions } from "./submissions.ts";

export { call, readAddress } from "./client.ts";
export { scopedScripts } from "./scripts.ts";
export async function startServer(
  home: string,
  factory: BackendFactory,
  options: ServerOptions = {},
): Promise<ServerHandle> {
  await mkdir(home, { recursive: true, mode: ServerLimit.DirectoryMode });
  await using resources = new AsyncDisposableStack();
  home = await realpath(home);
  await using maintenance = new AsyncDisposableStack();
  await ownMaintenance(home, maintenance);
  await assertUpdateSettled(home);
  await ownServer(home, resources);
  return await startOwnedServer(home, factory, resources, options);
}

async function pauseActive(engine: Engine): Promise<void> {
  for (const id of engine.ids()) {
    const state = engine.get(id).state;
    if (isActiveRun(state)) await engine.pause(id);
    await settle([() => engine.drain(id)], 1);
  }
}

async function startOwnedServer(
  home: string,
  factory: BackendFactory,
  resources: AsyncDisposableStack,
  options: ServerOptions,
): Promise<ServerHandle> {
  const db = new Bun.SQL({
    adapter: ServerDatabaseAdapter,
    filename: resolve(home, ServerFile.Database),
    strict: true,
  });
  resources.defer(() => db.close());
  for (const query of ServerSql.Initialize) await db.unsafe(query);
  await chmod(resolve(home, ServerFile.Database), ServerLimit.FileMode);
  const settings = await resolveConfig({ home, project: home });
  const knowledgeSettings: KnowledgeSettingsInput = settings.value.server.knowledge ?? {};
  const knowledge = await KnowledgeHub.open(
    home,
    knowledgeSettings,
    undefined,
    localMeaning(home, selectEmbedder(options.embedders, knowledgeSettings.embedder)),
  );
  resources.defer(() => knowledge.close());
  const nativeSettings = settings.value.server.native_tools;
  const owned = ownedKnowledge(
    home,
    knowledgeSettings,
    nativeSettings.max_pending_operations,
    knowledge,
  );
  const nativeAuthority: NativeToolAuthority = new NativeToolAuthority(
    knowledge,
    {
      max_bindings: nativeSettings.max_bindings,
      max_pending_operations: nativeSettings.max_pending_operations,
    },
    (scope, record): Promise<void> => engine.recordNativeTool(scope, record),
    (scope, action) => {
      const { execution_id: _execution, role: _role, ...attempt } = scope;
      return owned.use(engine.get(scope.run_id).project, async (local, home) =>
        action(await nativeRunKnowledge(local, home, attempt)),
      );
    },
    (scope, path) => engine.readNativeFile(scope, path),
    (scope, directory) => engine.listNativeFiles(scope, directory),
  );
  resources.defer(() => nativeAuthority.close());
  const nativeTools = options.nativeTools
    ? new NativeExecutions(
        nativeAuthority,
        (): string => server.url.href,
        options.nativeTools,
        nativeSettings.timeout_ms,
        nativeSettings.transport,
      )
    : undefined;
  const logger = await createLogger(settings.value.server.logging, options.diagnosticSink);
  let ready = false;
  let started = false;
  resources.defer(async () => {
    if (started) await logger.write({ level: LogLevel.Info, event: LogEvent.ServerStopped });
  });
  const projector = new RunSummaryProjector(
    db,
    settings.value.server.max_resident_runs ?? RuntimeLimit.ResidentRuns,
  );
  const build = ArtifactHashSchema.safeParse(options.runtimeBuild);
  const engine: Engine = new Engine(
    factory,
    {
      max_active_agents: settings.value.server.max_active_agents,
      max_pending_agents: settings.value.server.max_pending_agents,
      ...(settings.value.server.backend_limits
        ? { backend_limits: settings.value.server.backend_limits }
        : {}),
      max_pending_request_operations: settings.value.server.max_pending_request_operations,
      max_resident_runs: settings.value.server.max_resident_runs,
    },
    {
      ...(build.success ? { runtimeBuild: build.data } : {}),
      runtimePaths: ServerRuntimePaths.map((path) => resolve(home, path)),
      projectRun: (run, _kind, event) => projector.write(run, undefined, event),
      knowledge: owned.attempts,
      scripts: scopedScripts(
        (): Engine => engine,
        settings.value.server.max_active_agents,
        settings.value.server.max_pending_agents,
      ),
      hub: owned.hub,
      personaHistory: (run, events, request, usage) =>
        knowledge.recordPersonaHistory(run, events, request, usage),
      personaDecision: (request, stage) => knowledge.personaDecision(request, stage),
      openCalls: (tags, excluded) => knowledge.openCall(tags, excluded),
      ...(nativeTools ? { nativeTools } : {}),
    },
  );
  const operations = new KeyedQueue(
    settings.value.server.max_pending_run_operations ?? RuntimeLimit.PendingOperations,
  );
  const submissions = new KeyedQueue(
    settings.value.server.max_pending_submissions ?? RuntimeLimit.PendingOperations,
  );
  const submissionOwner = new RunSubmissions(
    home,
    factory,
    db,
    engine,
    operations,
    submissions,
    logger,
    knowledge,
  );
  const load = async (id: string): Promise<void> => {
    if (engine.has(id)) return engine.replayRequestEffects(id);
    const row = StoredRootSchema.optional().parse((await db.unsafe(ServerSql.Root, [id]))[0]);
    if (!row) throw new TitanError(ErrorCode.RunNotFound, ServerMessage.RunNotFound);
    await engine.load(row.root);
  };
  await settle(
    StoredRunSchema.array()
      .parse(await db.unsafe(ServerSql.Stored))
      .map((row) => async () => {
        if (!(await exists(resolve(row.root, BoardFile.Journal)))) return;
        const cached = await cachedRunSummary(db, row.id, row.root);
        if (
          cached &&
          (await cachedRunNumbers(db, cached, row.root)) &&
          ![RunStatus.Running, RunStatus.Recovering, RunStatus.Pausing].some(
            (state) => state === cached.state,
          )
        )
          return;
        const stamp = summaryStamp(row.root);
        const run = await new RunStore(
          row.root,
          undefined,
          build.success ? build.data : null,
        ).inspect();
        await writeRunSummary(db, run, stamp);
        if (isActiveRun(run.state)) await load(row.id);
      }),
    1,
  );
  const inspectRun = async (id: string, root: string) => {
    if (engine.has(id)) return engine.snapshot(id);
    return new RunStore(root, undefined, build.success ? build.data : null).inspect();
  };
  const readStoredRun: ReadStoredRun = (row) => inspectRun(row.id, row.root);
  const dashboard = new Dashboard(
    dashboardSource(db, engine, operations, load, readStoredRun, async (query) => {
      const embedder = selectEmbedder(options.embedders, knowledgeSettings.embedder);
      const homeView = await inspectKnowledge(home, embedder, knowledgeSettings);
      const runId = query.run_id;
      let projectHome = home;
      const projectView =
        runId === undefined
          ? homeView
          : await operations.use(runId, async () => {
              const row = StoredRootSchema.optional().parse(
                (await db.unsafe(ServerSql.Root, [runId]))[0],
              );
              if (!row) throw new TitanError(ErrorCode.RunNotFound, ServerMessage.RunNotFound);
              const run = await inspectRun(runId, row.root);
              projectHome = projectHubHome(run.project);
              return inspectKnowledge(projectHome, embedder, knowledgeSettings);
            });
      const view = ScopedKnowledgeHub.join(projectView, homeView, undefined, (scope, input) =>
        inspectPendingKnowledge(
          scope === KnowledgeScope.Project ? projectHome : home,
          input,
          knowledgeSettings,
        ),
      );
      return {
        list: await view.list({
          kind: query.kind,
          tag: query.tag,
          state: query.state,
          scope: runId === undefined ? KnowledgeScope.Home : query.scope,
        }),
        stats: await view.stats(runId === undefined ? KnowledgeScope.Home : query.scope),
        entry:
          query.id === undefined
            ? null
            : await view.show(query.id, runId === undefined ? KnowledgeScope.Home : query.scope, {
                before: query.before,
              }),
      };
    }),
  );
  const admission = new ServerAdmission();
  const stopped = Promise.withResolvers<void>();
  const token = newId() + newId();
  const tokens = { agent: token, person: await personToken(home) };
  async function route(request: Request, url: URL, authority: ClientAuthority): Promise<Response> {
    if (url.pathname === ServerRoute.Stop) {
      if (request.method !== HttpMethod.Post)
        throw new TitanError(ErrorCode.Method, ServerMessage.Method);
      if (authority !== ApprovalLevel.Human)
        throw new TitanError(ErrorCode.PermissionDenied, ServerMessage.MaintenancePerson);
      const parsed = ServerStopRequestSchema.safeParse(await request.json());
      if (!parsed.success || url.searchParams.size)
        throw new TitanError(ErrorCode.Arguments, ServerMessage.MaintenanceRequest);
      if (
        parsed.data.idle_only &&
        (admission.pending > 1 || engine.ids().some((id) => isActiveRun(engine.get(id).state)))
      )
        throw new TitanError(ErrorCode.ServerBusy, ServerMessage.MaintenanceBusy);
      void stopOnce().catch(() => undefined);
      return Response.json({ stopping: true });
    }
    if (url.pathname === DashboardRoute.Code) {
      if (request.method !== HttpMethod.Post)
        throw new TitanError(ErrorCode.Method, ServerMessage.Method);
      if (authority !== ApprovalLevel.Human)
        throw new TitanError(ErrorCode.PermissionDenied, DashboardMessage.Person);
      const code = dashboard.mint();
      return Response.json({ code, url: DashboardMessage.LoginLink(server.url.origin, code) });
    }
    if (url.pathname === KnowledgeRoute) return await knowledgeResponse(knowledge, request, url);
    if (url.pathname === RequestPageFormat.Route) {
      if (request.method !== HttpMethod.Get)
        throw new TitanError(ErrorCode.Method, ServerMessage.Method);
      const search = Object.fromEntries(url.searchParams);
      if (Object.keys(search).length !== url.searchParams.size)
        throw new TitanError(ErrorCode.Arguments, ServerMessage.DuplicateQuery);
      return Response.json(
        await listRequests(
          {
            database: db,
            read: (row, project) =>
              operations.use(row.id, async () => {
                await load(row.id);
                const run = await engine.snapshot(row.id);
                return {
                  project_path: run.project,
                  requests:
                    project !== undefined && run.project !== project
                      ? []
                      : await engine.requests.list(row.id),
                };
              }),
          },
          parseRequestListSearch(search),
        ),
      );
    }
    if (url.pathname === ServerRoute.Health && request.method === HttpMethod.Get)
      return Response.json(
        { ready, version: McpIdentity.Version, diagnostics: await logger.statistics() },
        {
          headers: { [HttpHeader.RuntimeBuild]: options.runtimeBuild ?? EmbeddedRuntimeBuild },
        },
      );
    if (url.pathname === LocalServer.Runs && request.method === HttpMethod.Get) {
      const search = Object.fromEntries(url.searchParams);
      if (Object.keys(search).length !== url.searchParams.size)
        throw new TitanError(ErrorCode.Arguments, ServerMessage.DuplicateQuery);
      const query = parseRunListSearch(search);
      return Response.json(
        await listRuns(db, query, (row) =>
          operations.use(row.id, () => describeRun(row, readStoredRun, db)),
        ),
      );
    }
    if (url.pathname === LocalServer.Runs && request.method === HttpMethod.Post)
      return await submissionOwner.submit(await request.json());
    const selection = await selectRequest(request, url);
    if (selection)
      return await operations.use(selection.run_id, async () => {
        await load(selection.run_id);
        const result = await operateRequest(engine.requests, selection, authority);
        if (
          selection.operation === RequestOperation.Answer &&
          [FileReconciliation.Operation, ScriptExecution.Operation].some(
            (operation) => operation === result.scope.operation,
          ) &&
          engine.get(selection.run_id).state === RunStatus.Waiting
        )
          void observeRun(engine.resume(selection.run_id), selection.run_id, logger);
        return Response.json(result);
      });
    const match = ServerRoute.Pattern.exec(url.pathname);
    if (!match?.[1])
      return Response.json(
        { code: ServerCode.NotFound, error: ServerMessage.Route },
        { status: 404 },
      );
    const id = decodeURIComponent(match[1]);
    return await operations.use(id, () => runResponse(request, url, match, id));
  }
  async function runResponse(
    request: Request,
    url: URL,
    match: RegExpExecArray,
    id: string,
  ): Promise<Response> {
    await load(id);
    const action = match[2];
    if (match[3] && action !== CliCommand.Artifacts)
      throw new TitanError(ErrorCode.Method, ServerMessage.Operation);
    if (request.method === HttpMethod.Get && action === CliCommand.Config) {
      if (url.searchParams.size) throw new TitanError(ErrorCode.Arguments, ServerMessage.Operation);
      return Response.json(describeRunConfiguration(await engine.snapshot(id)));
    }
    if (request.method === HttpMethod.Get && action === CliCommand.Usage) {
      if (url.searchParams.size) throw new TitanError(ErrorCode.Arguments, ServerMessage.Operation);
      return Response.json(await engine.usage(id));
    }
    if (request.method === HttpMethod.Get && action === CliCommand.Events) {
      const search = Object.fromEntries(url.searchParams);
      if (Object.keys(search).length !== url.searchParams.size)
        throw new TitanError(ErrorCode.Arguments, ServerMessage.DuplicateQuery);
      return Response.json(await engine.events(id, parseEventSearch(search)));
    }
    if (request.method === HttpMethod.Get && action === ServerRoute.Stream) {
      const first = cursorOf(request);
      if (first === undefined) throw new TitanError(ErrorCode.Arguments, DashboardMessage.Cursor);
      await engine.events(id, { after: first });
      return new Response(
        eventBody((after) => operations.use(id, () => engine.events(id, { after })), first),
        {
          headers: {
            [DashboardHeader.ContentType]: DashboardPolicy.EventStream,
            [DashboardHeader.CacheControl]: DashboardPolicy.CacheControl,
          },
        },
      );
    }
    if (request.method === HttpMethod.Get && action === CliCommand.Artifacts) {
      const search = Object.fromEntries(url.searchParams);
      if (Object.keys(search).length !== url.searchParams.size)
        throw new TitanError(ErrorCode.Arguments, ServerMessage.DuplicateQuery);
      const run = await engine.snapshot(id);
      if (match[3])
        return Response.json(
          await readArtifact(run, decodeURIComponent(match[3]), parseArtifactSearch(search)),
        );
      if (url.searchParams.size) throw new TitanError(ErrorCode.Arguments, ServerMessage.Operation);
      return Response.json(await inspectArtifacts(run));
    }
    if (request.method === HttpMethod.Post) {
      if (action === RunAction.Resume) {
        const backend = parseResumeBackend(url.searchParams.get(UsageLimit.Query));
        void observeRun(engine.resume(id, backend), id, logger);
      } else if (action === RunAction.Pause) await engine.pause(id);
      else if (action === RunAction.Cancel) await engine.cancel(id);
      else throw new TitanError(ErrorCode.Method, ServerMessage.Operation);
    } else if (request.method !== HttpMethod.Get || action)
      throw new TitanError(ErrorCode.Method, ServerMessage.Method);
    const run = await engine.snapshot(id);
    return Response.json({
      ...run,
      ...(run.schema_version >= RunFormat.ProofReports ? { proofs: runProofSummary(run) } : {}),
    });
  }
  const server = Bun.serve({
    hostname: LocalServer.Host,
    port: 0,
    idleTimeout: ServerLimit.IdleSeconds,
    maxRequestBodySize: ServerLimit.RequestBytes,
    fetch(request): Promise<Response> {
      if (new URL(request.url).pathname === NativeTool.Route)
        return nativeAuthority.respond(request);
      return admission.use(() => respond(request)).catch(failureResponse);
    },
  });
  async function respond(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (dashboard.handles(url.pathname)) {
      return dashboard.respond(request, server.url.origin).catch(failureResponse);
    }
    if (request.headers.has(HttpOriginHeader))
      return Response.json(
        { code: ErrorCode.PermissionDenied, error: CredentialMessage.Origin },
        { status: HttpStatus.Forbidden },
      );
    const authority = authenticate(request.headers, tokens);
    if (!authority)
      return Response.json(
        { code: ServerCode.Unauthorized, error: ServerMessage.Authentication },
        { status: HttpStatus.Unauthorized },
      );
    try {
      return await route(request, url, authority);
    } catch (error) {
      return failureResponse(error);
    }
  }
  function failureResponse(error: unknown): Response {
    let status = error instanceof TitanError ? HttpStatus.BadRequest : HttpStatus.Internal;
    if (
      error instanceof TitanError &&
      (error.code === ErrorCode.ServerBusy ||
        error.code === ErrorCode.EventCursor ||
        error.code === ErrorCode.RequestConflict ||
        error.code === ErrorCode.SubmissionConflict ||
        error.code === ErrorCode.KnowledgeConflict ||
        error.code === ErrorCode.RequestExpired)
    )
      status = HttpStatus.Conflict;
    if (error instanceof TitanError && error.code === ErrorCode.PermissionDenied)
      status = HttpStatus.Forbidden;
    if (error instanceof TitanError && error.code === ErrorCode.ServerStopping)
      status = HttpStatus.Unavailable;
    if (
      error instanceof TitanError &&
      (error.code === ErrorCode.RequestNotFound || error.code === ErrorCode.KnowledgeMissing)
    )
      status = HttpStatus.NotFound;
    return Response.json(
      {
        code: error instanceof TitanError ? error.code : ServerCode.Internal,
        error: errorMessage(error),
        ...(error instanceof RunRuntimeError
          ? { required_runtime: error.requiredRuntime, required_build: error.requiredBuild }
          : {}),
      },
      { status },
    );
  }
  resources.defer(() => server.stop(true));
  const address = { url: localServerUrl(server.port ?? 0), token, pid: process.pid };
  await atomicWrite(resolve(home, LocalServer.File), JSON.stringify(address));
  resources.defer(() => rm(resolve(home, LocalServer.File), { force: true }));
  resources.defer(async () => {
    ready = false;
    await admission.close();
    await pauseActive(engine);
  });
  await logger.write({ level: LogLevel.Info, event: LogEvent.ServerReady });
  ready = true;
  started = true;
  const lifetime = resources.move();
  let stopping: Promise<void> | undefined;
  async function stop(): Promise<void> {
    ready = false;
    try {
      await admission.close();
      await lifetime.disposeAsync();
    } finally {
      stopped.resolve();
    }
  }
  function stopOnce(): Promise<void> {
    stopping ??= stop();
    return stopping;
  }
  return {
    address,
    stopped: stopped.promise,
    stop: stopOnce,
  };
}
