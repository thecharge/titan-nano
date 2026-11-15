import { mkdir, open, stat, truncate } from "node:fs/promises";
import { resolve } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  BoardFile,
  BoardLimit,
  ErrorCode,
  ExecutionPhase,
  FileOpenMode,
  FileWriteScope,
  GoalExecution,
  Newline,
  PathPart,
  PersonaRule,
  RequestLimit,
  RunFile,
  RunFormat,
  StepStatus,
  TextSymbol,
  TitanRelease,
  VerifyKind,
  WorkflowField,
} from "@titan/constants";
import { assertSafeId, hash } from "@titan/core";
import { RunRuntimeError, TitanError } from "@titan/errors";
import {
  BoardMessage,
  unsupportedRunBuild,
  unsupportedRunFormat,
  unsupportedRunRuntime,
} from "@titan/messages";
import { jsonByteLength } from "@titan/streams";
import {
  type BackendId,
  ConfigSchema,
  type EffectiveConfig,
  type NodeState,
  type Phase,
  type Plan,
  type Run,
  type RunEvent,
  RunEventSchema,
  RunFormatProbeSchema,
  type RunOrigin,
  type RunProjectionWriter,
  type RunValidationCache,
  RunValidationCacheSchema,
  type Step,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { atomicWrite, ensureEventLog } from "./files.ts";
import { boardLines } from "./journal.ts";
import { retainRunOrigin } from "./origin.ts";

export { readEventPage } from "./events.ts";
export { atomicWrite, atomicWriteStream, runResultChunks } from "./files.ts";
export {
  boardDecision,
  boardDecisions,
  boardPersonaPicks,
  boardPost,
  boardPosts,
  boardStepAdds,
} from "./posts.ts";
export {
  collectProofReport,
  countProof,
  emptyProofSummary,
  keptProof,
  runProofSummary,
} from "./proofs.ts";

function restoredNodes(run: Run, plan: Plan): Step[] {
  const picks = run.picks ?? {};
  if (Object.keys(picks).some((id) => !plan.nodes.some((step) => step.id === id)))
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
  return run.plan.nodes.slice(0, plan.nodes.length).map((step, index) => {
    const persona = picks[step.id];
    if (persona === undefined) return step;
    const call = plan.nodes[index]?.do;
    if (
      !call ||
      !(WorkflowField.Call in call) ||
      !(WorkflowField.Persona in step.do) ||
      step.do.persona !== persona ||
      step.do.task !== call.call.task ||
      !(persona in run.plan.workflow.personas)
    )
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
    return { ...step, do: call };
  });
}

function validatePlan(run: Run): void {
  const picked = new Set(Object.values(run.picks ?? {}));
  const workflow = {
    ...run.plan.workflow,
    personas: Object.fromEntries(
      Object.entries(run.plan.workflow.personas).filter(([name]) => !picked.has(name)),
    ),
  };
  const plan = validateWorkflow(workflow, run.config.value.limits.max_group_depth);
  const original = { ...run.plan, workflow, nodes: restoredNodes(run, plan) };
  if (plan.revision !== run.plan.revision || JSON.stringify(plan) !== JSON.stringify(original))
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
  validateSourcePlan(run, plan);
  validatePersonaReferences(run, run.source_plan ?? plan);
}

function validatePersonaReferences(run: Run, source: Plan): void {
  const references = run.persona_references;
  if (!references) return;
  const entries = source.workflow.personas;
  if (
    run.schema_version < RunFormat.PersonaBindings ||
    JSON.stringify(Object.keys(entries).sort()) !== JSON.stringify(Object.keys(references).sort())
  )
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
  for (const [name, entry] of Object.entries(entries)) {
    const value = references[name] ?? TextSymbol.Empty;
    if (WorkflowField.Use in entry) {
      if (value !== entry.use) throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
      continue;
    }
    const at = value.lastIndexOf(PersonaRule.VersionMark);
    const parent = WorkflowField.Mutates in entry ? entry.mutates : undefined;
    const expected = parent ? parent.slice(0, parent.lastIndexOf(PersonaRule.VersionMark)) : name;
    const version = Number(value.slice(at + 1));
    if (
      value.slice(0, at) !== expected ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      (parent && version <= Number(parent.slice(parent.lastIndexOf(PersonaRule.VersionMark) + 1)))
    )
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
  }
}

function validateSourcePlan(run: Run, plan: Plan): void {
  if (!run.source_plan) {
    if (plan.revision !== run.workflow_revision)
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
    return;
  }
  const source = validateWorkflow(
    { ...plan.workflow, personas: run.source_plan.workflow.personas },
    run.config.value.limits.max_group_depth,
  );
  if (
    run.schema_version < RunFormat.PersonaBindings ||
    source.revision !== run.workflow_revision ||
    JSON.stringify(source) !== JSON.stringify(run.source_plan)
  )
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
  validatePersonaBindings(run.source_plan, plan);
}

function validatePersonaBindings(source: Plan, resolved: Plan): void {
  const original = source.workflow.personas;
  const bindings = resolved.workflow.personas;
  if (JSON.stringify(Object.keys(original).sort()) !== JSON.stringify(Object.keys(bindings).sort()))
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
  for (const [name, entry] of Object.entries(original)) {
    const binding = bindings[name];
    if (!binding || WorkflowField.Use in binding || WorkflowField.Mutates in binding)
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
    if (
      !(WorkflowField.Use in entry) &&
      !(WorkflowField.Mutates in entry) &&
      JSON.stringify(binding) !== JSON.stringify(entry)
    )
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Plan);
  }
}

function validateRecord(run: Run, root: string, cache: RunValidationCache): void {
  if (
    run.goal &&
    (run.schema_version < RunFormat.GoalProofs ||
      run.goal.attempt !== GoalExecution.Attempt ||
      !run.plan.workflow.verify?.some((check) => check.kind === VerifyKind.Script) ||
      (run.goal.work !== run.project && run.goal.work !== resolve(root, RunFile.Artifacts)))
  )
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  if (
    run.root !== root ||
    resolve(run.project, BoardFile.Runs, run.run_id) !== root ||
    run.base !== resolve(root, BoardFile.Base)
  )
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Paths);
  const configuration = JSON.stringify(run.config);
  if (configuration !== cache.configuration) {
    const settings = ConfigSchema.parse(run.config.value);
    if (hash(JSON.stringify(settings)) !== run.config.hash)
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Configuration);
    cache.configuration = configuration;
    cache.plan = null;
  }
  const plan = JSON.stringify([
    run.schema_version,
    run.plan,
    run.source_plan,
    run.persona_references,
    run.picks ?? {},
    run.workflow_revision,
  ]);
  if (plan !== cache.plan) {
    validatePlan(run);
    cache.plan = plan;
  }
  if (
    JSON.stringify(Object.keys(run.nodes).sort()) !==
    JSON.stringify(run.plan.nodes.map((step) => step.id).sort())
  )
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Nodes);
  for (const [step, node] of Object.entries(run.nodes)) {
    validateNode(node, root, run.project);
    validateWriteInputs(run, step, node);
    validateHelpers(run, step, node);
    if (
      node.reconciliations &&
      (run.schema_version < RunFormat.Reconciliation ||
        node.reconciliations.length > run.config.value.recovery.max_retries)
    )
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
    for (const [index, generation] of (node.reconciliations ?? []).entries())
      if (
        generation.input !==
        resolve(
          root,
          RunFile.Steps,
          step,
          `${RunFile.AttemptPrefix}${node.attempt}`,
          `${RunFile.ReconciliationPrefix}${index + 1}`,
          RunFile.Input,
        )
      )
        throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Workspace);
    if (
      run.schema_version < RunFormat.ReadClaims &&
      (node.read_paths !== undefined ||
        Object.values(node.phases).some((phase) => phase.file_claim?.read_paths !== undefined))
    )
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
    if (
      run.schema_version < RunFormat.FileObservations &&
      Object.values(node.phases).some((phase) => phase.file_reads !== undefined)
    )
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
    const incompatibleReceipt = [
      node.phases,
      ...(node.reconciliations?.map((generation) => generation.phases) ?? []),
    ]
      .flatMap((phases) => Object.entries(phases))
      .some(
        ([key, phase]) =>
          phase.capture_pending !== undefined &&
          (run.schema_version < RunFormat.CaptureReceipts || key !== ExecutionPhase.Worker),
      );
    if (incompatibleReceipt) throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
    if (
      run.schema_version < RunFormat.RequestTurns &&
      Object.values(node.phases).some((phase) => phase.request_turn !== undefined)
    )
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  }
}

function validateHelpers(run: Run, step: string, node: NodeState): void {
  const helpers = Object.entries(node.phases).filter(
    ([key, phase]) => phase.helper || key.startsWith(ExecutionPhase.HelperPrefix),
  );
  if (helpers.length > RequestLimit.PerRun)
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  for (const [key, phase] of helpers) {
    const helper = phase.helper;
    if (
      run.schema_version < RunFormat.HelperTurns ||
      !helper ||
      key !== ExecutionPhase.HelperPrefix + helper.request_id ||
      !run.plan.workflow.personas[helper.persona] ||
      helper.origin.step_id !== step ||
      helper.origin.attempt !== node.attempt ||
      !node.phases[helper.origin.phase] ||
      helper.harness_session_id !== node.phases[helper.origin.phase]?.session_id ||
      (helper.received && (!phase.execution_id || !phase.session_id || phase.usage.length === 0)) ||
      (phase.completed && !helper.received)
    )
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  }
}

function validateWriteInputs(run: Run, step: string, node: NodeState): void {
  if ((node.write_paths || node.write_inputs) && run.schema_version < RunFormat.WriteClaims)
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  if (node.write_inputs && !node.write_paths)
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  for (const [index, entry] of (node.write_inputs ?? []).entries()) {
    if (
      entry.input !==
        resolve(
          run.root,
          RunFile.Steps,
          step,
          `${RunFile.AttemptPrefix}${node.attempt}`,
          `${FileWriteScope.InputPrefix}${index + 1}`,
        ) ||
      entry.generation > (node.reconciliations?.length ?? 0) ||
      entry.generation < (node.write_inputs?.[index - 1]?.generation ?? 0) ||
      !entry.paths.every((path) =>
        node.write_paths?.some(
          (allowed) => path === allowed || path.startsWith(allowed + PathPart.Separator),
        ),
      )
    )
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Workspace);
  }
}

function validateNode(node: NodeState, root: string, project: string): void {
  for (const path of [
    node.input,
    node.work,
    node.snapshot,
    ...(node.reconciliations?.map((generation) => generation.input) ?? []),
    ...(node.write_inputs?.map((entry) => entry.input) ?? []),
  ]) {
    if (path === project && path === node.work) continue;
    if (path !== null && (!path.startsWith(root + BoardFile.Steps) || resolve(path) !== path))
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Workspace);
  }
}

function parseEvent(
  text: string,
  root: string,
  previous: number,
  cache: RunValidationCache,
  runtimeVersion: string | null = TitanRelease,
  runtimeBuild?: string | null,
): RunEvent {
  try {
    const input: unknown = JSON.parse(text);
    const probe = RunFormatProbeSchema.safeParse(input);
    if (
      probe.success &&
      !Object.values(RunFormat).some((version) => version === probe.data.state.schema_version)
    )
      throw new TitanError(
        ErrorCode.UnsupportedRunFormat,
        unsupportedRunFormat(probe.data.state.schema_version),
      );
    const event = RunEventSchema.parse(input);
    if (event.id !== previous + 1 || event.state.version !== event.id)
      throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Sequence);
    if (
      runtimeVersion !== null &&
      event.state.runtime_version !== undefined &&
      event.state.runtime_version !== runtimeVersion
    )
      throw new RunRuntimeError(
        event.state.runtime_version,
        unsupportedRunRuntime(event.state.runtime_version, runtimeVersion),
        event.state.runtime_build,
      );
    if (
      runtimeVersion !== null &&
      runtimeBuild !== undefined &&
      event.state.runtime_build !== undefined &&
      event.state.runtime_build !== runtimeBuild
    )
      throw new RunRuntimeError(
        event.state.runtime_version ?? TitanRelease,
        unsupportedRunBuild(event.state.runtime_version ?? TitanRelease, event.state.runtime_build),
        event.state.runtime_build,
      );
    validateRecord(event.state, root, cache);
    return event;
  } catch (error) {
    if (
      error instanceof TitanError &&
      (error.code === ErrorCode.UnsupportedRunFormat ||
        error.code === ErrorCode.UnsupportedRunRuntime)
    )
      throw error;
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  }
}

export class RunStore {
  private validation = RunValidationCacheSchema.parse({ configuration: null, plan: null });
  private pending: Promise<void> = Promise.resolve();
  private version = 0;
  private committed: Run | undefined;
  private origin: RunOrigin | undefined;
  constructor(
    public readonly root: string,
    private projection?: RunProjectionWriter,
    private runtimeBuild?: string | null,
  ) {}

  static forRun(project: string, id: string): RunStore {
    return new RunStore(resolve(project, BoardFile.Runs, assertSafeId(id)));
  }

  commit(run: Run, type: string, data: unknown = null): Promise<void> {
    const version = Math.max(this.version, run.version) + 1;
    const record = {
      id: version,
      time: Date.now(),
      type,
      data,
      state: { ...run, version },
    };
    try {
      jsonByteLength(record, BoardLimit.RecordBytes);
    } catch (error) {
      if (error instanceof TitanError && error.code === ErrorCode.StreamLimit)
        throw new TitanError(ErrorCode.DurableWrite, BoardMessage.Limit);
      throw error;
    }
    const text = JSON.stringify(record);
    assertNoSecrets(Buffer.from(text));
    const event = parseEvent(
      text,
      this.root,
      version - 1,
      this.validation,
      TitanRelease,
      this.runtimeBuild,
    );
    this.origin = retainRunOrigin(event.state, this.origin);
    this.version = version;
    this.pending = this.pending.then(async () => {
      await this.append(text);
      run.version = version;
      await atomicWrite(resolve(this.root, BoardFile.State), JSON.stringify(event.state));
      await this.projection?.(event.state, type, event);
      this.committed = event.state;
    });
    return this.pending;
  }

  async snapshot(): Promise<Run> {
    await this.pending;
    if (!this.committed) throw new TitanError(ErrorCode.RunNotFound, BoardMessage.Missing);
    return structuredClone(this.committed);
  }

  private async append(text: string): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const file = await open(resolve(this.root, BoardFile.Journal), FileOpenMode.Append, 0o600);
    try {
      await file.writeFile(Buffer.from(text + Newline));
      await file.sync();
      await ensureEventLog(this.root);
    } finally {
      await file.close();
    }
  }

  async *events(through: number = Number.MAX_SAFE_INTEGER): AsyncGenerator<RunEvent> {
    let previous = 0;
    let origin: RunOrigin | undefined;
    for await (const line of boardLines(resolve(this.root, BoardFile.Journal))) {
      if (previous >= through) return;
      const event = parseEvent(
        line.text,
        this.root,
        previous,
        this.validation,
        TitanRelease,
        this.runtimeBuild,
      );
      origin = retainRunOrigin(event.state, origin);
      previous = event.id;
      yield event;
    }
  }

  async inspect(): Promise<Run> {
    let state: Run | undefined;
    for await (const event of this.events()) state = event.state;
    if (!state) throw new TitanError(ErrorCode.RunNotFound, BoardMessage.Missing);
    return state;
  }

  async inspectCopy(source: string, runtimeVersion: string | null): Promise<Run> {
    let state: Run | undefined;
    let origin: RunOrigin | undefined;
    for await (const line of boardLines(resolve(source, BoardFile.Journal))) {
      const event = parseEvent(
        line.text,
        this.root,
        state?.version ?? 0,
        this.validation,
        runtimeVersion,
        this.runtimeBuild,
      );
      origin = retainRunOrigin(event.state, origin);
      state = event.state;
    }
    if (!state) throw new TitanError(ErrorCode.RunNotFound, BoardMessage.Missing);
    return state;
  }

  async read(): Promise<Run> {
    let state: Run | undefined;
    let origin: RunOrigin | undefined;
    let validEnd = 0;
    const path = resolve(this.root, BoardFile.Journal);
    for await (const line of boardLines(path)) {
      const event = parseEvent(
        line.text,
        this.root,
        state?.version ?? 0,
        this.validation,
        TitanRelease,
        this.runtimeBuild,
      );
      origin = retainRunOrigin(event.state, origin);
      state = event.state;
      validEnd = line.end;
    }
    if (!state) throw new TitanError(ErrorCode.RunNotFound, BoardMessage.Missing);
    await ensureEventLog(this.root);
    if ((await stat(path)).size > validEnd) await truncate(path, validEnd);
    await this.projection?.(state);
    this.origin = origin;
    this.version = state.version;
    this.committed = structuredClone(state);
    return state;
  }
}

export function initialPhase(): Phase {
  return {
    session_id: null,
    execution_id: null,
    executions: 0,
    retries: 0,
    next_retry: null,
    completed: false,
    answer: null,
    usage: [],
    error: null,
  };
}
export function executionNode(run: Run, id: string): NodeState | undefined {
  return id === GoalExecution.Id ? run.goal : run.nodes[id];
}

export function initialNode(): NodeState {
  return {
    state: StepStatus.Pending,
    attempt: 1,
    refutations: 0,
    phases: {},
    evidence: [],
    input: null,
    work: null,
    snapshot: null,
    changes: {},
    output: null,
  };
}
export function requestHash(
  plan: Plan,
  project: string,
  config: EffectiveConfig,
  backend: BackendId,
): string {
  return hash(JSON.stringify({ plan, project, config: config.hash, backend }));
}
