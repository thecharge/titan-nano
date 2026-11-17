import { realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import {
  atomicWrite,
  initialNode,
  RunStore,
  readEventPage,
  requestHash,
  runResultChunks,
} from "@titan/board";
import {
  AgentTool,
  BoardFile,
  BoardLimit,
  BoardParty,
  BoardPostKind,
  ErrorCode,
  Improver,
  NativeTool,
  NativeToolAudit,
  NativeToolOutcome,
  NativeToolRole,
  PathPart,
  PersonaDecisionStage,
  PersonaRule,
  RequestDecision,
  RequestExecutionCheck,
  RequestKind,
  RunArtifactFile,
  RunBlock,
  RunEventKind,
  RunFile,
  RunFormat,
  RunResultFormat,
  RunStatus,
  RuntimeLimit,
  StatementState,
  StepCap,
  StepStatus,
  StoreEviction,
  TimerLimit,
  TitanRelease,
  VerifyKind,
  WorkflowField,
} from "@titan/constants";
import { assertSafeId, hash, isActiveRun, newId, settle } from "@titan/core";
import { errorMessage, OperationalError, TitanError } from "@titan/errors";
import { recordRunPersonas, retainWorkspaceSkills } from "@titan/knowledge";
import {
  NativeToolMessage,
  RequestMessage,
  RunnerMessage,
  selfFalsification,
  stepsDropped,
} from "@titan/messages";
import { RequestLedger, requestExecutionMatches } from "@titan/requests";
import { BoundedStore, KeyedQueue } from "@titan/store";
import { atomicWriteStream } from "@titan/streams";
import type {
  BackendFactory,
  BackendId,
  EffectiveConfig,
  EngineServices,
  EventPage,
  EventQueryInput,
  NativeFileChange,
  NativeImproverBinding,
  NativeToolAuditRecord,
  NativeToolExecutionOwner,
  NativeToolScope,
  NodeState,
  OpenCall,
  OpenCallResolver,
  OperationRequest,
  PersonaDecisionWriter,
  PersonaRequest,
  PhaseExecution,
  Plan,
  RequestTurnBatch,
  Run,
  RunProjectionWriter,
  ScriptExecution,
  Step,
  StepRestart,
} from "@titan/types";
import {
  ArtifactHashSchema,
  type EngineSettingsInput,
  EngineSettingsSchema,
  NativeToolBoardSchema,
  OperationRequestSchema,
  type RunCreation,
  RunSchema,
  WorkspaceOmissionsSchema,
  WorkspaceRelativePathSchema,
} from "@titan/types";
import {
  assertBuiltFeatures,
  assertStatementPaths,
  resolvedPersona,
  validatePlanTools,
  workflowFile,
} from "@titan/workflow";
import { exists, readWorkspaceSnapshot, treeHash, writeTree } from "@titan/workspace";
import { assembleRun } from "./artifacts.ts";
import { Capacity } from "./capacity.ts";
import { FileAccess } from "./file-access.ts";
import { GoalChecks } from "./goal-checks.ts";
import { improvementRounds, improveRun } from "./improver.ts";
import { RunKnowledge } from "./knowledge.ts";
import { nativeToolBoard } from "./native-audit.ts";
import {
  listNativeFiles,
  nativeFileRoot,
  readNativeFile,
  retainNativeRead,
  writeNativeFile,
} from "./native-files.ts";
import { AgentPhases } from "./phases.ts";
import { writeProofReport } from "./proof-report.ts";
import { limitReset, nextRetry, projectRunStatus, retryAt, waitForRetry } from "./recovery.ts";
import { projectRequests } from "./request-projection.ts";
import { RunHubFlow } from "./run-hub-flow.ts";
import { isSkillPath, readSkill } from "./skill-role.ts";
import { StatementLocks } from "./statement-locks.ts";
import { RunSteps } from "./steps.ts";
import { summarizeUsage } from "./usage.ts";

const terminal = [RunStatus.Passed, RunStatus.Failed, RunStatus.Cancelled, RunStatus.TimedOut];
const journaled = [...terminal, RunStatus.Blocked];
export class Engine {
  private improvers = new Map<string, NativeImproverBinding>();
  private nativeTools: NativeToolExecutionOwner | undefined;
  private nativeWrites = new KeyedQueue(RuntimeLimit.PendingOperations);
  private active: BoundedStore<string, Promise<void>>;
  private controllers: BoundedStore<string, AbortController>;
  private timers: BoundedStore<string, ReturnType<typeof setTimeout>>;
  private runs: BoundedStore<string, Run>;
  private stores: BoundedStore<string, RunStore>;
  private requestEffects: BoundedStore<string, number>;
  private settings;
  private scripted: boolean;
  private hub: RunHubFlow;
  private steps: RunSteps;
  private goals: GoalChecks;
  private files: FileAccess;
  private capacity: Capacity;
  private requestLedger: RequestLedger | undefined;
  private requestOptions;
  private openCalls: OpenCallResolver | undefined;
  private personaDecision: PersonaDecisionWriter | undefined;
  private projectRun: RunProjectionWriter | undefined;
  private runtimePaths: readonly string[];
  private runtimeBuild: string | undefined;
  private locks = new StatementLocks({
    ledger: () => this.requests,
    events: (run) => this.store(run.run_id).events(),
    commit: (run, type, data) => this.commit(run, type, data),
  });
  get requests(): RequestLedger {
    this.requestLedger ??= new RequestLedger(
      {
        snapshot: (id) => this.store(id).snapshot(),
        events: (id, through) => this.store(id).events(through),
        append: (id, kind, request) => this.appendRequest(id, kind, request),
      },
      this.requestOptions,
    );
    return this.requestLedger;
  }
  constructor(
    private factory: BackendFactory,
    settings: EngineSettingsInput = {},
    services: EngineServices = {},
  ) {
    this.settings = EngineSettingsSchema.parse(settings);
    this.projectRun = services.projectRun;
    this.runtimeBuild = ArtifactHashSchema.optional().parse(services.runtimeBuild);
    this.nativeTools = services.nativeTools;
    this.runtimePaths = services.runtimePaths ?? [];
    this.files = new FileAccess(
      (run, type, data) => this.commit(run, type, data),
      this.settings.max_pending_agents,
    );
    this.scripted = services.scripts !== undefined;
    this.openCalls = services.openCalls;
    this.personaDecision = services.personaDecision;
    const knowledge = new RunKnowledge(services.knowledge, (run, type, data) =>
      this.commit(run, type, data),
    );
    this.hub = new RunHubFlow(
      services.hub,
      (run, type, data) => this.commit(run, type, data),
      (run) => this.store(run.run_id).events(run.version),
      services.personaHistory,
      (run, request) => this.requestPersona(run, request),
    );
    const bounds = { maxEntries: this.settings.max_resident_runs, eviction: StoreEviction.Reject };
    this.active = new BoundedStore(bounds);
    this.controllers = new BoundedStore(bounds);
    this.timers = new BoundedStore(bounds);
    this.runs = new BoundedStore(bounds);
    this.stores = new BoundedStore(bounds);
    this.requestEffects = new BoundedStore(bounds);
    this.requestOptions = { max_pending_operations: this.settings.max_pending_request_operations };
    this.capacity = new Capacity(
      this.settings.max_active_agents,
      this.settings.max_pending_agents,
      this.settings.backend_limits,
    );
    const phases = new AgentPhases(
      factory,
      this.capacity,
      (run, type, data) => this.commit(run, type, data),
      () => this.requests,
      (context, requests) => this.publishRequestTurn(context, requests),
      this.hub,
      services.nativeTools,
      services.clock,
      this.files,
    );
    this.goals = new GoalChecks(
      (run, type, data) => this.commit(run, type, data),
      this.files,
      services.scripts,
    );
    this.steps = new RunSteps(
      phases,
      knowledge,
      this.hub,
      (run, type, data) => this.commit(run, type, data),
      this.capacity,
      () => this.requests,
      services.scripts,
      this.files,
    );
  }
  agentCapacity() {
    return this.capacity.snapshot();
  }
  private createStore(root: string): RunStore {
    const store: RunStore = new RunStore(
      root,
      async (run, kind, event) => {
        await projectRequests(store, this.requests, run, kind);
        await this.projectRun?.(run, kind, event);
      },
      this.runtimeBuild ?? null,
    );
    return store;
  }
  private async requestPersona(run: Run, request: PersonaRequest): Promise<void> {
    const request_id = hash(JSON.stringify([run.run_id, request]));
    if ((await this.requests.list(run.run_id)).some((saved) => saved.request_id === request_id))
      return;
    await this.requests.open(run.run_id, {
      request_id,
      kind: request.kind,
      scope: {
        operation: request.kind,
        resource: request.names.join(PersonaRule.TagSeparator),
        content_hashes: {},
        arguments: [
          ...request.names,
          JSON.stringify({
            refutations: request.refutations,
            run_id: run.run_id,
            through: run.version,
          }),
        ],
        environment_names: [],
      },
      origin: { client_id: run.client_id, harness_session_id: null },
      expires_at: Date.now() + StepCap.ExpiresMs,
    });
  }
  preflight(plan: Plan, config: EffectiveConfig, backend: BackendId): void {
    validatePlanTools(plan, config.value.defaults.backend ?? backend);
    if (plan.nodes.length > config.value.limits.max_steps)
      throw new TitanError(ErrorCode.StepLimit, RunnerMessage.StepLimit);
    for (const action of this.scripted
      ? []
      : plan.nodes.flatMap((step) => [step.do, ...step.falsify]))
      if (WorkflowField.Script in action)
        throw new TitanError(ErrorCode.ScriptPending, RunnerMessage.ScriptPending);
    if (
      !this.scripted &&
      ((plan.workflow.verify ?? []).some((check) => check.kind === VerifyKind.Script) ||
        plan.nodes.some(
          (step) =>
            step.checks.length || step.verify.some((entry) => entry.kind === VerifyKind.Script),
        ))
    )
      throw new TitanError(ErrorCode.ScriptPending, RunnerMessage.ScriptPending);
    assertBuiltFeatures(plan);
    for (const name of Object.keys(plan.workflow.personas))
      this.factory(
        resolvedPersona(plan.workflow, name).backend ?? config.value.defaults.backend ?? backend,
        config,
      );
  }
  async create(options: RunCreation): Promise<Run> {
    const { config, backend, client_id, submission_id } = options;
    const plan = options.resolved_plan ?? options.plan;
    const project = resolve(options.project);
    const source = workflowFile(
      options.plan,
      options.workflow_source,
      config.value.limits.max_group_depth,
    );
    await assertStatementPaths(plan, project);
    this.preflight(plan, config, backend);
    const run_id = assertSafeId(options.run_id ?? newId());
    const root = resolve(project, BoardFile.Runs, run_id);
    if (await exists(resolve(root, BoardFile.Journal)))
      throw new TitanError(ErrorCode.ExistingRun, RunnerMessage.ExistingRun);
    const base = resolve(root, BoardFile.Base);
    const canonical = await realpath(project);
    const runtimePaths = WorkspaceOmissionsSchema.parse(
      this.runtimePaths
        .map((path) => relative(canonical, path))
        .filter((path) => WorkspaceRelativePathSchema.safeParse(path).success),
    );
    const selectedSkills = new Set(
      Object.keys(plan.workflow.personas ?? {}).flatMap(
        (name) => resolvedPersona(plan.workflow, name).skills ?? [],
      ),
    );
    const workspaceSkills = await retainWorkspaceSkills(project, process.env, selectedSkills);
    const files = await readWorkspaceSnapshot(
      project,
      config.value.limits,
      undefined,
      runtimePaths,
      plan.nodes.flatMap((step) => step.files ?? []),
    );
    await writeTree(base, files, config.value.limits);
    const format =
      (plan.workflow.verify ?? []).some((check) => check.kind === VerifyKind.Script) ||
      plan.nodes.some((step) => step.verify.some((entry) => entry.kind === VerifyKind.Script))
        ? RunFormat.ProofCaptures
        : options.resolved_plan || options.persona_references
          ? RunFormat.PersonaBindings
          : RunFormat.PinnedRuntime;
    const run: Run = {
      schema_version: this.runtimeBuild ? RunFormat.PinnedBuild : format,
      runtime_version: TitanRelease,
      ...(this.runtimeBuild ? { runtime_build: this.runtimeBuild } : {}),
      ...(options.harness_session_id !== undefined
        ? { harness_session_id: options.harness_session_id }
        : {}),
      run_id,
      workflow_id:
        plan.workflow.workflow_id ??
        hash(`${project}${PathPart.Separator}${options.workflow_path ?? plan.workflow.name}`),
      workflow_revision: options.plan.revision,
      ...(options.persona_references ? { persona_references: options.persona_references } : {}),
      submission_id,
      client_id,
      request_hash: requestHash(options.plan, project, config, backend),
      project,
      omit_generated_workspace: true,
      ...(workspaceSkills.index.length ? { workspace_skills: workspaceSkills } : {}),
      ...(runtimePaths.length ? { runtime_paths: runtimePaths } : {}),
      root,
      version: 0,
      created_at: Date.now(),
      state: RunStatus.Running,
      error: null,
      config,
      plan,
      ...(options.resolved_plan ? { source_plan: options.plan } : {}),
      backend,
      nodes: Object.fromEntries(plan.nodes.map((node) => [node.id, initialNode()])),
      base,
      base_hash: await treeHash(files),
      artifacts: null,
    };
    const store = this.createStore(root);
    await atomicWrite(resolve(root, RunFile.Workflow), source);
    await atomicWrite(resolve(root, RunFile.Config), JSON.stringify(config, null, 2));
    if (options.persona_references) await recordRunPersonas(root, options.persona_references);
    await store.commit(run, RunEventKind.Created, { base_hash: await treeHash(files) });
    this.retain(run, store);
    return run;
  }
  private async runImprover(run: Run, signal: AbortSignal): Promise<void> {
    const name = run.plan.workflow.improve?.persona ?? Improver.DefaultPersona;
    const persona = resolvedPersona(run.plan.workflow, name);
    if (
      !this.nativeTools ||
      !persona.tools.includes(AgentTool.Read) ||
      !persona.skills?.length ||
      !run.workspace_skills
    ) {
      await improveRun(this.factory, run, signal);
      return;
    }
    const execution_id = newId();
    const scope = {
      run_id: run.run_id,
      step_id: Improver.InvocationId,
      candidate_id: Improver.InvocationId,
      part_id: null,
      attempt: 1,
      role: NativeToolRole.Improver,
      execution_id,
    } as const;
    const active = { name, persona, scope };
    this.improvers.set(execution_id, active);
    try {
      const tools = this.nativeTools.open(scope, () => !signal.aborted, run.root);
      try {
        await improveRun(this.factory, run, signal, {}, tools);
      } finally {
        await tools.close();
      }
    } finally {
      this.improvers.delete(execution_id);
    }
  }

  async load(root: string): Promise<Run> {
    const store = this.createStore(root);
    const run = await store.read();
    if (run.root !== root) throw new TitanError(ErrorCode.RunPath, RunnerMessage.RunPath);
    this.retain(run, store);
    if (this.personaDecision) this.requestEffects.set(run.run_id, run.version);
    await this.replayRequestEffects(run.run_id);
    if (!isActiveRun(run.state)) return run;
    run.state = RunStatus.Blocked;
    run.error = RunnerMessage.Restart;
    if (run.goal?.state === StepStatus.Running) run.goal.state = StepStatus.Blocked;
    const restarted: StepRestart[] = [];
    for (const [stepId, node] of Object.entries(run.nodes))
      if (node.state === StepStatus.Running) {
        node.state = StepStatus.Blocked;
        restarted.push({
          step_id: stepId,
          attempt: node.attempt,
          checkpoint: node.snapshot,
          segment: Object.values(node.phases).reduce((total, phase) => total + phase.executions, 1),
        });
      }
    await this.commit(run, RunEventKind.Restart, { reason: run.error });
    for (const entry of restarted) await this.commit(run, RunEventKind.StepRestarted, entry);
    return run;
  }
  has(id: string): boolean {
    return this.runs.has(id);
  }
  ids(): string[] {
    return [...this.runs.keys()];
  }
  private retain(run: Run, store: RunStore): void {
    if (!this.runs.has(run.run_id) && this.runs.size >= this.settings.max_resident_runs) {
      const inactive = [...this.runs.keys()].find((id) => !this.active.has(id));
      if (!inactive) throw new OperationalError(ErrorCode.Capacity, RunnerMessage.ResidentCapacity);
      this.disarm(inactive);
      this.runs.delete(inactive);
      this.stores.delete(inactive);
      this.requestEffects.delete(inactive);
    }
    this.runs.set(run.run_id, run);
    this.stores.set(run.run_id, store);
  }
  get(id: string): Run {
    const run = this.runs.get(id);
    if (!run) throw new TitanError(ErrorCode.RunNotFound, RunnerMessage.RunNotFound);
    return run;
  }
  private store(id: string): RunStore {
    const store = this.stores.get(id);
    if (!store) throw new TitanError(ErrorCode.RunNotFound, RunnerMessage.StoreNotFound);
    return store;
  }
  drain(id: string): Promise<void> {
    return this.active.get(id) ?? Promise.resolve();
  }
  recordScript(execution: ScriptExecution, type: RunEventKind, data: unknown): Promise<void> {
    return this.commit(this.get(execution.run_id), type, { ...execution, data });
  }
  validateFileExecution(execution: ScriptExecution): void {
    this.files.validate(this.get(execution.run_id), execution);
  }
  async snapshot(id: string): Promise<Run> {
    const pending = this.active.get(id);
    if (pending && journaled.includes(this.get(id).state)) await pending;
    return this.store(id).snapshot();
  }
  async replayRequestEffects(id: string): Promise<void> {
    const pending = this.requestEffects.get(id);
    if (!this.personaDecision || pending === undefined) return;
    for await (const event of this.store(id).events(pending))
      if (event.type === RunEventKind.RequestAnswered)
        await this.personaDecision(
          OperationRequestSchema.parse(event.data),
          PersonaDecisionStage.Publish,
          this.get(id).project,
        );
    if (this.requestEffects.get(id) === pending) this.requestEffects.delete(id);
  }
  private async appendRequest(
    id: string,
    kind: RunEventKind,
    request: OperationRequest,
  ): Promise<void> {
    const run = this.get(id);
    if (
      kind === RunEventKind.RequestOpened &&
      !requestExecutionMatches(request, run, RequestExecutionCheck.Admission)
    )
      throw new TitanError(ErrorCode.PermissionDenied, RequestMessage.Execution);
    const previous = run.schema_version;
    if (kind === RunEventKind.RequestAnswered) {
      await this.replayRequestEffects(id);
      await this.personaDecision?.(request, PersonaDecisionStage.Validate, run.project);
    }
    if (request.origin.execution && run.schema_version < RunFormat.ExecutionRequests)
      run.schema_version = RunFormat.ExecutionRequests;
    if (request.answer?.persona && run.schema_version < RunFormat.PersonaAnswers)
      run.schema_version = RunFormat.PersonaAnswers;
    try {
      await this.store(id).commit(run, kind, request);
    } catch (error) {
      run.schema_version = previous;
      throw error;
    }
    if (kind === RunEventKind.RequestAnswered && this.personaDecision) {
      const through = run.version;
      this.requestEffects.set(id, through);
      await this.personaDecision?.(request, PersonaDecisionStage.Publish, run.project);
      if (this.requestEffects.get(id) === through) this.requestEffects.delete(id);
    }
  }
  private publishRequestTurn(context: PhaseExecution, requests: RequestTurnBatch): Promise<void> {
    const { run, state, phase } = context;
    for (const request of requests)
      if (!requestExecutionMatches(request, run, RequestExecutionCheck.Admission))
        throw new TitanError(ErrorCode.PermissionDenied, RequestMessage.Execution);
    const previous = { format: run.schema_version, state: state.state, turn: phase.request_turn };
    if (run.schema_version < RunFormat.RequestTurns) run.schema_version = RunFormat.RequestTurns;
    state.state = StepStatus.Waiting;
    phase.request_turn = {
      execution_id: context.execution_id,
      request_ids: requests.map((request) => request.request_id),
      waiting: true,
    };
    try {
      return this.store(run.run_id).commit(run, RunEventKind.RequestTurnOpened, requests);
    } catch (error) {
      run.schema_version = previous.format;
      state.state = previous.state;
      if (previous.turn) phase.request_turn = previous.turn;
      else delete phase.request_turn;
      throw error;
    }
  }
  private async commit(run: Run, type: string, data: unknown = null): Promise<void> {
    projectRunStatus(run);
    await this.store(run.run_id).commit(run, type, data);
  }
  async events(id: string, query: EventQueryInput = {}): Promise<EventPage> {
    const store = this.store(id);
    const committed = await store.snapshot();
    return readEventPage(store.events(committed.version), query, id);
  }
  async usage(id: string) {
    const store = this.store(id);
    const committed = await store.snapshot();
    return summarizeUsage(committed, store.events(committed.version));
  }

  async addStep(id: string, step: Step, from: string): Promise<boolean> {
    const run = this.get(id);
    if (run.plan.nodes.length < run.config.value.limits.max_steps) {
      run.plan.nodes.push(step);
      run.nodes[step.id] = initialNode();
      await this.commit(run, RunEventKind.StepAdded, {
        kind: BoardPostKind.StepAdded,
        step_id: step.id,
        added_by: from,
      });
      return true;
    }
    await this.commit(run, RunEventKind.RequestRefused, {
      from,
      to: BoardParty.Titan,
      kind: BoardPostKind.Refused,
      text: RunnerMessage.StepRefused,
    });
    const open = (await this.requests.list(id)).some(
      (request) => request.kind === RequestKind.RaiseLimit && request.answer === null,
    );
    if (!open)
      await this.requests.open(id, {
        request_id: newId(),
        kind: RequestKind.RaiseLimit,
        scope: {
          operation: StepCap.Operation,
          resource: StepCap.Resource,
          content_hashes: {},
          arguments: [RunnerMessage.RaiseLimit],
          environment_names: [],
        },
        origin: { client_id: run.client_id, harness_session_id: null },
        expires_at: Date.now() + StepCap.ExpiresMs,
      });
    return false;
  }

  async addSteps(
    id: string,
    steps: readonly Step[],
    from: string,
    survives: () => Promise<boolean>,
  ): Promise<boolean> {
    const run = this.get(id);
    if (steps.some((step) => step.falsify.length + step.verify.length === 0)) {
      await this.commit(run, RunEventKind.RequestRefused, {
        from,
        to: BoardParty.Titan,
        kind: BoardPostKind.Refused,
        text: RunnerMessage.NoFalsifier,
      });
      return false;
    }
    if (!(await survives())) {
      await this.commit(run, RunEventKind.RequestRefused, {
        from,
        to: BoardParty.Titan,
        kind: BoardPostKind.Dropped,
        text: stepsDropped(
          from,
          steps.map((step) => step.id),
        ),
      });
      return false;
    }
    for (const step of steps) if (!(await this.addStep(id, step, from))) return false;
    return true;
  }

  async recordNativeTool(scope: NativeToolScope, record: NativeToolAuditRecord): Promise<void> {
    const run = this.get(scope.run_id);
    if (scope.role === NativeToolRole.Improver) {
      const { name } = this.activeImprover(scope);
      await this.commit(
        run,
        NativeToolAudit.Kind,
        NativeToolBoardSchema.parse({
          ...scope,
          ...record,
          kind: NativeToolAudit.Kind,
          from: name,
        }),
      );
      return;
    }
    const data = nativeToolBoard(run, scope, record);
    const phase = Object.values(run.nodes[scope.step_id]?.phases ?? {}).find(
      (phase) => phase.execution_id === scope.execution_id,
    );
    const previous = phase?.file_reads;
    if (phase && data.observation) {
      phase.file_reads = retainNativeRead(
        previous ?? [],
        data.observation,
        run.config.value.limits.max_workspace_entries,
      );
      if (run.schema_version < RunFormat.FileObservations)
        run.schema_version = RunFormat.FileObservations;
    }
    try {
      await this.commit(run, NativeToolAudit.Kind, data);
    } catch (error) {
      if (phase && previous) phase.file_reads = previous;
      else if (phase) delete phase.file_reads;
      throw error;
    }
  }

  private activeImprover(scope: NativeToolScope) {
    const active = this.improvers.get(scope.execution_id);
    if (
      !active ||
      active.scope.run_id !== scope.run_id ||
      active.scope.step_id !== scope.step_id ||
      active.scope.candidate_id !== scope.candidate_id ||
      active.scope.attempt !== scope.attempt ||
      active.scope.part_id !== scope.part_id
    )
      throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
    return active;
  }

  async readNativeFile(scope: NativeToolScope, path: string) {
    if (scope.role === NativeToolRole.Improver) {
      const { persona } = this.activeImprover(scope);
      const run = this.get(scope.run_id);
      if (!persona.tools.includes(AgentTool.Read) || !isSkillPath(run, path))
        throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
      return readSkill(run, path, persona);
    }
    const run = await this.nativeFileRun(scope);
    if (isSkillPath(run, path)) {
      const identity = nativeToolBoard(run, scope, {
        tool: NativeTool.Ready,
        outcome: NativeToolOutcome.Returned,
        entry_ids: [],
      });
      return readSkill(run, path, resolvedPersona(run.plan.workflow, identity.from));
    }
    const root = nativeFileRoot(run, scope);
    return readNativeFile(run, root, path, true);
  }

  async listNativeFiles(scope: NativeToolScope, directory: string) {
    const run = await this.nativeFileRun(scope);
    return listNativeFiles(run, nativeFileRoot(run, scope), directory);
  }

  writeNativeFile(scope: NativeToolScope, change: NativeFileChange) {
    return this.nativeWrites.use(this.get(scope.run_id).project, () =>
      this.changeNativeFile(scope, change),
    );
  }

  private async changeNativeFile(scope: NativeToolScope, change: NativeFileChange) {
    if (scope.role !== NativeToolRole.Worker)
      throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
    const run = await this.nativeFileRun(scope, [AgentTool.Write, AgentTool.Edit]);
    const step = run.plan.nodes.find((node) => node.id === scope.step_id);
    const phase = Object.entries(run.nodes[scope.step_id]?.phases ?? {}).find(
      ([, value]) => value.execution_id === scope.execution_id,
    );
    if (!step || !phase)
      throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
    this.files.validate(run, {
      run_id: run.run_id,
      step_id: step.id,
      attempt: scope.attempt,
      phase: phase[0],
      execution_id: scope.execution_id,
      file_claim: phase[1].file_claim,
    });
    return writeNativeFile(run, step, nativeFileRoot(run, scope), change);
  }

  private async nativeFileRun(
    scope: NativeToolScope,
    tools: readonly AgentTool[] = [AgentTool.Read],
  ): Promise<Run> {
    const run = this.get(scope.run_id);
    const identity = nativeToolBoard(run, scope, {
      tool: NativeTool.Ready,
      outcome: NativeToolOutcome.Returned,
      entry_ids: [],
    });
    if (
      resolvedPersona(run.plan.workflow, identity.from).tools.some((tool) =>
        tools.some((allowed) => allowed === tool),
      )
    )
      return run;
    const phase = Object.entries(run.nodes[scope.step_id]?.phases ?? {}).find(
      ([, value]) => value.execution_id === scope.execution_id,
    );
    const pending = phase?.[1].request_turn;
    const records = pending ? await this.requests.list(run.run_id) : [];
    const granted = records.some(
      (request) =>
        run.state === RunStatus.Running &&
        run.nodes[scope.step_id]?.state === StepStatus.Running &&
        pending?.waiting === false &&
        pending.request_ids.includes(request.request_id) &&
        request.kind === RequestKind.Tool &&
        tools.some((tool) => request.scope.resource === tool) &&
        request.answer?.decision === RequestDecision.Approve &&
        request.origin.client_id === run.client_id &&
        request.origin.harness_session_id === phase?.[1].session_id &&
        request.origin.execution?.step_id === scope.step_id &&
        request.origin.execution.attempt === scope.attempt &&
        request.origin.execution.phase === phase?.[0] &&
        request.origin.execution.execution_id === pending.execution_id,
    );
    nativeToolBoard(run, scope, {
      tool: NativeTool.Ready,
      outcome: NativeToolOutcome.Returned,
      entry_ids: [],
    });
    if (!granted) throw new OperationalError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
    return run;
  }

  start(id: string): Promise<void> {
    const existing = this.active.get(id);
    if (existing) return existing;
    const run = this.get(id);
    if (terminal.includes(run.state)) return Promise.resolve();
    if (run.pending_journal) {
      const work = this.journal(run).finally(() => this.active.delete(id));
      this.active.set(id, work);
      return work;
    }
    const controller = new AbortController();
    this.controllers.set(id, controller);
    run.state = RunStatus.Running;
    const work = (async () => {
      await this.commit(run, RunEventKind.Started);
      await this.hub.open(run);
      await this.execute(run, controller);
      if ([RunStatus.Passed, RunStatus.Failed].includes(run.state) && improvementRounds(run) > 0)
        await this.runImprover(run, controller.signal);
    })()
      .catch(async (error: unknown) => {
        if (!terminal.includes(run.state)) {
          run.state = RunStatus.Blocked;
          run.error = errorMessage(error);
          await this.commit(run, RunEventKind.Blocked, { error: run.error });
        }
      })
      .then(() => this.journal(run))
      .finally(() => {
        this.active.delete(id);
        this.controllers.delete(id);
        const reset = run.state === RunStatus.Blocked ? limitReset(run) : null;
        if (reset !== null) this.arm(id, reset);
      });
    this.active.set(id, work);
    return work;
  }
  private async journal(run: Run): Promise<void> {
    if (!journaled.includes(run.state)) return;
    const pending = run.pending_journal;
    const intended =
      pending ??
      RunSchema.shape.pending_journal.unwrap().parse({ state: run.state, error: run.error });
    try {
      await this.hub.journal({ ...run, ...intended });
      if (pending ? run.pending_journal !== pending : run.state !== intended.state)
        return this.journal(run);
      if (pending) {
        run.state = pending.state;
        run.error = pending.error;
        delete run.pending_journal;
        await this.commit(run, RunEventKind.JournalCompleted);
      }
    } catch (error) {
      run.pending_journal ??= RunSchema.shape.pending_journal.unwrap().parse({
        state: run.state,
        error: run.error,
      });
      run.state = RunStatus.Blocked;
      run.error = errorMessage(error);
      await this.commit(run, RunEventKind.Blocked, { error: run.error });
    }
  }
  private disarm(id: string): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }
  private arm(id: string, at: number): void {
    this.disarm(id);
    const timer = setTimeout(
      () => {
        void this.resume(id);
      },
      Math.max(0, at - Date.now()),
    );
    timer.unref();
    this.timers.set(id, timer);
  }
  private switchBackend(run: Run, backend: BackendId): void {
    this.factory(backend, run.config);
    run.backend = backend;
    run.switched_backend = backend;
  }
  resume(id: string, backend?: BackendId): Promise<void> {
    const run = this.get(id);
    if (terminal.includes(run.state))
      throw new TitanError(ErrorCode.TerminalRun, RunnerMessage.TerminalRun);
    const existing = this.active.get(id);
    if (existing)
      return run.state === RunStatus.Blocked || run.state === RunStatus.Waiting
        ? existing.then(() => this.resume(id, backend))
        : existing;
    if (run.pending_journal) return this.start(id);
    this.disarm(id);
    if (run.error === RunBlock.Limit) run.error = null;
    if (backend) this.switchBackend(run, backend);
    for (const node of [...Object.values(run.nodes), ...(run.goal ? [run.goal] : [])])
      if (
        node.state === StepStatus.Blocked ||
        node.state === StepStatus.Running ||
        node.state === StepStatus.Waiting
      ) {
        node.state = StepStatus.Pending;
        if (backend)
          for (const [key, phase] of Object.entries(node.phases))
            if (!phase.completed) delete node.phases[key];
      }
    return this.start(id);
  }
  async pause(id: string): Promise<void> {
    const run = this.get(id);
    if (terminal.includes(run.state))
      throw new TitanError(ErrorCode.TerminalRun, RunnerMessage.TerminalPause);
    this.disarm(id);
    run.state = RunStatus.Pausing;
    this.controllers.get(id)?.abort(new Error(RunnerMessage.Pause));
    await this.commit(run, RunEventKind.PauseRequested);
    await this.active.get(id);
    if (run.state === RunStatus.Pausing) {
      run.state = RunStatus.Paused;
      await this.commit(run, RunEventKind.Paused);
    }
  }
  async cancel(id: string): Promise<void> {
    const run = this.get(id);
    if (terminal.includes(run.state)) return;
    this.disarm(id);
    run.state = RunStatus.Cancelled;
    delete run.pending_journal;
    this.controllers.get(id)?.abort(new Error(RunnerMessage.Cancel));
    await this.commit(run, RunEventKind.Cancelled);
    const working = this.active.get(id);
    await working;
    if (!working) await this.journal(run);
  }
  private async stepFailure(
    run: Run,
    step: Step,
    state: NodeState,
    controller: AbortController,
    error: unknown,
  ): Promise<void> {
    if (controller.signal.aborted) {
      if (!terminal.includes(run.state)) state.state = StepStatus.Pending;
      return;
    }
    if (
      error instanceof TitanError &&
      error.code === ErrorCode.RequestWaiting &&
      state.state === StepStatus.Waiting
    )
      return;
    if (
      error instanceof OperationalError &&
      error.code === ErrorCode.RecoveryScheduled &&
      retryAt(state) !== null
    ) {
      state.state = StepStatus.Pending;
      await this.commit(run, RunEventKind.ExecutionDeferred, { step_id: step.id });
      return;
    }
    state.state = StepStatus.Blocked;
    await this.commit(run, RunEventKind.StepBlocked, {
      step_id: step.id,
      error: errorMessage(error),
    });
  }

  private async answerCall(
    run: Run,
    step: Step,
    call: OpenCall,
    state: NodeState,
  ): Promise<boolean> {
    const excluded = step.falsify.flatMap((action) =>
      WorkflowField.Persona in action
        ? [run.persona_references?.[action.persona] ?? action.persona]
        : [],
    );
    const pick = await this.openCalls?.(call.tags, excluded);
    if (!pick) {
      const resource = call.tags.join(PersonaRule.TagSeparator);
      state.state = StepStatus.Waiting;
      const open = (await this.requests.list(run.run_id)).some(
        (request) =>
          request.kind === RequestKind.NewPersona &&
          request.scope.resource === resource &&
          request.answer === null,
      );
      if (!open)
        await this.requests.open(run.run_id, {
          request_id: newId(),
          kind: RequestKind.NewPersona,
          scope: {
            operation: RequestKind.NewPersona,
            resource,
            content_hashes: {},
            arguments: [call.task, ...call.tags],
            environment_names: [],
          },
          origin: { client_id: run.client_id, harness_session_id: null },
          expires_at: Date.now() + StepCap.ExpiresMs,
        });
      return false;
    }
    const persona = `${pick.entry.name}${PersonaRule.VersionMark}${pick.entry.version}`;
    if (excluded.includes(persona))
      throw new TitanError(ErrorCode.SelfFalsification, selfFalsification(step.id));
    const action = { persona, task: call.task };
    this.preflight(
      {
        ...run.plan,
        workflow: {
          ...run.plan.workflow,
          personas: { ...run.plan.workflow.personas, [persona]: pick.entry.persona },
        },
        nodes: run.plan.nodes.map((node) => (node.id === step.id ? { ...node, do: action } : node)),
      },
      run.config,
      run.backend,
    );
    run.plan.workflow.personas[persona] = pick.entry.persona;
    step.do = action;
    run.picks = { ...run.picks, [step.id]: persona };
    await this.commit(run, RunEventKind.PersonaPicked, {
      kind: BoardPostKind.PersonaPicked,
      step_id: step.id,
      persona,
      rule: pick.rule,
      ...(pick.seed === undefined ? {} : { seed: pick.seed, eligible: pick.eligible }),
    });
    return true;
  }

  private async admitSteps(
    run: Run,
    controller: AbortController,
    running: Map<string, Promise<void>>,
  ): Promise<boolean> {
    let dependenciesSkipped = false;
    for (const step of run.plan.nodes) {
      const state = run.nodes[step.id];
      if (state?.state !== StepStatus.Pending || running.has(step.id)) continue;
      const retry = retryAt(state);
      if (retry !== null && retry > Date.now()) continue;
      if (
        (step.needs ?? []).some((id) =>
          [StepStatus.Failed, StepStatus.SkippedDependency].some(
            (status) => status === run.nodes[id]?.state,
          ),
        )
      ) {
        state.state = StepStatus.SkippedDependency;
        dependenciesSkipped = true;
        await this.commit(run, RunEventKind.StepSkipped, { step_id: step.id });
        continue;
      }
      if (!(step.needs ?? []).every((id) => run.nodes[id]?.state === StepStatus.Passed)) continue;
      const lock = await this.locks.ready(run, step);
      if (lock === StatementState.Waiting) {
        state.state = StepStatus.Waiting;
        continue;
      }
      if (lock === StatementState.Denied) {
        state.state = StepStatus.Blocked;
        await this.commit(run, RunEventKind.StepBlocked, {
          step_id: step.id,
          error: RunnerMessage.StatementDenied,
        });
        continue;
      }
      if (!(await this.prepareCall(run, step, state, controller))) continue;
      state.state = StepStatus.Running;
      const task = this.steps
        .execute(run, step, state, controller.signal)
        .catch((error: unknown) => this.stepFailure(run, step, state, controller, error))
        .finally(() => {
          running.delete(step.id);
        });
      running.set(step.id, task);
    }
    return dependenciesSkipped;
  }

  private async prepareCall(
    run: Run,
    step: Step,
    state: NodeState,
    controller: AbortController,
  ): Promise<boolean> {
    if (!(WorkflowField.Call in step.do)) return true;
    try {
      return await this.answerCall(run, step, step.do.call, state);
    } catch (error) {
      await this.stepFailure(run, step, state, controller, error);
      return false;
    }
  }

  private async waitForWork(run: Run, signal: AbortSignal): Promise<boolean> {
    const retry = nextRetry(run);
    if (retry === null) return false;
    try {
      await waitForRetry(retry, signal);
    } catch (error) {
      if (!signal.aborted) throw error;
    }
    return true;
  }

  private async schedule(
    run: Run,
    controller: AbortController,
    deadline: number | null,
    running: Map<string, Promise<void>>,
  ): Promise<void> {
    while (!controller.signal.aborted) {
      if (deadline !== null && Date.now() >= deadline) {
        run.state = RunStatus.TimedOut;
        await this.commit(run, RunEventKind.TimedOut);
        controller.abort(new Error(RunnerMessage.Deadline));
        break;
      }
      const skipped = await this.admitSteps(run, controller, running);
      if (!running.size && skipped) continue;
      if (!running.size && !(await this.waitForWork(run, controller.signal))) break;
      if (!running.size) continue;
      await Promise.race(running.values());
    }
  }

  private async failRun(run: Run, signal: AbortSignal): Promise<void> {
    await writeProofReport(run);
    await atomicWriteStream(
      resolve(run.root, RunArtifactFile.Result),
      runResultChunks(run),
      BoardLimit.RecordBytes,
    );
    if (signal.aborted) return;
    run.state = RunStatus.Failed;
    await this.commit(run, RunEventKind.Failed);
  }

  private async verifyGoal(run: Run, result_hash: string, signal: AbortSignal): Promise<boolean> {
    try {
      if (await this.goals.execute(run, result_hash, signal)) return true;
      await this.failRun(run, signal);
      return false;
    } catch (error) {
      if (signal.aborted) return false;
      if (error instanceof TitanError && error.code === ErrorCode.RequestWaiting) {
        if (run.goal) run.goal.state = StepStatus.Waiting;
        run.state = RunStatus.Waiting;
        await this.commit(run, RunEventKind.Waiting);
        return false;
      }
      if (run.goal) run.goal.state = StepStatus.Blocked;
      throw error;
    }
  }

  private async execute(run: Run, controller: AbortController): Promise<void> {
    const running = new Map<string, Promise<void>>();
    const deadline =
      run.config.value.limits.max_minutes === null
        ? null
        : run.created_at + run.config.value.limits.max_minutes * 60_000;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const expire = (): void => {
      if (deadline === null) return;
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        timeout = setTimeout(expire, Math.min(TimerLimit.Milliseconds, remaining));
        return;
      }
      controller.abort(new Error(RunnerMessage.Deadline));
    };
    expire();
    try {
      await this.schedule(run, controller, deadline, running);
      await settle(
        [...running.values()].map((task) => () => task),
        run.config.value.limits.max_parallel,
      );
      if (
        controller.signal.aborted &&
        deadline !== null &&
        Date.now() >= deadline &&
        (run.state === RunStatus.Running || run.state === RunStatus.Recovering)
      ) {
        run.state = RunStatus.TimedOut;
        await this.commit(run, RunEventKind.TimedOut);
      }
      if (controller.signal.aborted || terminal.includes(run.state)) return;
      const values = Object.values(run.nodes);
      if (
        values.some((node) => node.state === StepStatus.Waiting) &&
        !values.some((node) => node.state === StepStatus.Blocked)
      ) {
        run.state = RunStatus.Waiting;
        await this.commit(run, RunEventKind.Waiting);
        return;
      }
      if (values.some((v) => v.state === StepStatus.Blocked || v.state === StepStatus.Pending)) {
        run.state = RunStatus.Blocked;
        if (limitReset(run) !== null) run.error = RunBlock.Limit;
        await this.commit(run, RunEventKind.Blocked);
        return;
      }
      if (values.some((v) => v.state === StepStatus.Failed)) {
        await this.failRun(run, controller.signal);
        return;
      }
      const files = await assembleRun(run, new Set(run.plan.nodes.map((v) => v.id)));
      run.artifacts = resolve(run.root, RunFile.Artifacts);
      await writeTree(run.artifacts, files, run.config.value.limits);
      if (!(await this.verifyGoal(run, await treeHash(files), controller.signal))) return;
      const outputs = Object.fromEntries(
        run.plan.nodes
          .filter((v) => !run.plan.nodes.some((n) => n.needs?.includes(v.id)))
          .map((v) => [v.id, run.nodes[v.id]?.output]),
      );
      const proofs_hash = await writeProofReport(run);
      await atomicWriteStream(
        resolve(run.root, RunArtifactFile.Result),
        runResultChunks(run, outputs),
        BoardLimit.RecordBytes,
      );
      await atomicWrite(
        resolve(run.root, RunArtifactFile.Manifest),
        JSON.stringify(
          {
            hash: await treeHash(files),
            ...(run.schema_version >= RunFormat.ProofReports ? { proofs_hash } : {}),
            paths: Object.keys(files),
            outputs,
            result_format:
              run.schema_version >= RunFormat.ProofReports
                ? RunResultFormat.ProofVersion
                : RunResultFormat.PassedVersion,
          },
          null,
          2,
        ),
      );
      run.state = RunStatus.Passed;
      await this.commit(run, RunEventKind.Passed, {
        artifact_hash: await treeHash(files),
        ...(run.schema_version >= RunFormat.ProofReports ? { proofs_hash } : {}),
        result_format:
          run.schema_version >= RunFormat.ProofReports
            ? RunResultFormat.ProofVersion
            : RunResultFormat.PassedVersion,
      });
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }
  }
}
