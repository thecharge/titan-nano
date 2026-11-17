import { realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { executionNode } from "@titan/board";
import {
  AgentTool,
  ErrorCode,
  FileAccessMode,
  FileAccessQueue,
  FileWriteScope,
  NativeFileField,
  PathPart,
  RequestDecision,
  RequestKind,
  RunEventKind,
  RunFormat,
  RuntimeLimit,
  SignalEvent,
  StepStatus,
  StoreEviction,
  VerifyKind,
} from "@titan/constants";
import { filePathCovers, fileScopesOverlap, newId } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import { BoundedStore, KeyedQueue } from "@titan/store";
import {
  type AsyncTask,
  type FileAccessAdmission,
  FileAccessClaimSchema,
  type FileAccessWaiter,
  type FileExecutionClaim,
  FileExecutionClaimSchema,
  type FileExecutionOrigin,
  FileExecutionOriginSchema,
  type FileProjectResolver,
  FileReadPathsSchema,
  FileWritePathsSchema,
  FileWriteRequestScopeSchema,
  type OperationRequest,
  type Run,
  type RunCommit,
  type ScriptExecution,
  type Step,
  type StepAction,
} from "@titan/types";
import { personaAction, resolvedPersona } from "@titan/workflow";
import { scopeCovers, writePaths } from "./file-scope.ts";
import { liveRun } from "./live.ts";
import { captureWriteInput } from "./write-inputs.ts";

function writes(run: Run, entry: StepAction): boolean {
  const action = personaAction(entry);
  if (!action) return true;
  const persona = resolvedPersona(run.plan.workflow, action.persona);
  if (persona.request_turns) return true;
  return !persona.tools.every((tool) =>
    [AgentTool.Read, AgentTool.Glob, AgentTool.Grep].some((allowed) => allowed === tool),
  );
}

export function accessMode(run: Run, step: Step): FileAccessMode {
  const actions = [step.do, ...step.falsify, ...(step.reconcile ? [step.reconcile] : [])];
  return step.checks.length ||
    step.verify.some((entry) => entry.kind === VerifyKind.Script) ||
    actions.some((action) => writes(run, action))
    ? FileAccessMode.Write
    : FileAccessMode.Read;
}

function observedParent(path: string, observed: ReadonlySet<string>): boolean {
  let parent = dirname(path);
  while (parent !== PathPart.Current) {
    if (observed.has(parent)) return true;
    parent = dirname(parent);
  }
  return false;
}

import { isSkillPath } from "./skill-role.ts";

export class FileAccess {
  private admission = new KeyedQueue(RuntimeLimit.PendingOperations);
  private entries = new BoundedStore<string, FileAccessWaiter>({
    maxEntries: RuntimeLimit.PendingOperations,
    eviction: StoreEviction.Reject,
  });
  constructor(
    private commit: RunCommit,
    private maximum: number,
    private projectPath: FileProjectResolver = realpath,
  ) {}

  private pump(): void {
    const earlier: FileAccessWaiter[] = [];
    for (const waiter of this.entries.values()) {
      if (
        !waiter.active &&
        !earlier.some((other) => fileScopesOverlap(other.claim, waiter.claim))
      ) {
        waiter.active = true;
        waiter.start();
      }
      earlier.push(waiter);
    }
  }

  private async admit(run: Run, step: Step, signal: AbortSignal): Promise<FileAccessAdmission> {
    signal.throwIfAborted();
    const project = await this.projectPath(run.project);
    signal.throwIfAborted();
    const claim = FileAccessClaimSchema.parse({
      claim_id: newId(),
      run_id: run.run_id,
      step_id: step.id,
      attempt: executionNode(run, step.id)?.attempt,
      project,
      mode: accessMode(run, step),
      paths: writePaths(run, step).map((path) => resolve(project, path)),
      ...(executionNode(run, step.id)?.read_paths
        ? {
            read_paths: executionNode(run, step.id)?.read_paths?.map((path) =>
              resolve(project, path),
            ),
          }
        : {}),
    });
    const blockers = [...this.entries.values()].filter((other) =>
      fileScopesOverlap(other.claim, claim),
    );
    const waiting = blockers.length > 0;
    if (
      waiting &&
      [...this.entries.values()].filter((entry) => !entry.active).length >= this.maximum
    )
      throw new OperationalError(ErrorCode.Capacity, RunnerMessage.PendingCapacity);
    const key = newId();
    const ready = Promise.withResolvers<void>();
    const waiter = { claim, active: !waiting, start: ready.resolve };
    this.entries.set(key, waiter);
    if (!waiting) ready.resolve();
    return {
      key,
      claim,
      waiter,
      ready: ready.promise,
      waiting,
      owners: blockers.map((entry) => entry.claim),
    };
  }

  reviseReads(run: Run, step: Step): Promise<boolean> {
    return this.admission.use(FileAccessQueue, () => this.retainReads(run, step));
  }

  reviseWrites(
    run: Run,
    step: Step,
    requests: OperationRequest[],
    worker: boolean,
  ): Promise<boolean> {
    return this.admission.use(FileAccessQueue, () =>
      this.retainWrites(run, step, requests, worker),
    );
  }

  private async retainWrites(
    run: Run,
    step: Step,
    requests: OperationRequest[],
    worker: boolean,
  ): Promise<boolean> {
    const selected = requests.filter(
      (request) =>
        request.kind === RequestKind.Resource &&
        request.scope.operation === FileWriteScope.Operation &&
        request.answer?.decision === RequestDecision.Approve,
    );
    if (!selected.length) return false;
    if (!liveRun(run) || !worker)
      throw new OperationalError(ErrorCode.PermissionDenied, RunnerMessage.FileWriteScope);
    const paths: string[] = [];
    for (const request of selected) {
      const parsed = FileWriteRequestScopeSchema.safeParse(request.scope);
      if (!parsed.success)
        throw new OperationalError(ErrorCode.PermissionDenied, RunnerMessage.FileWriteScope);
      if (
        run.runtime_paths?.some(
          (path) =>
            scopeCovers(path, parsed.data.resource) || scopeCovers(parsed.data.resource, path),
        )
      )
        throw new OperationalError(ErrorCode.PermissionDenied, RunnerMessage.FileWriteScope);
      paths.push(parsed.data.resource);
    }
    const state = executionNode(run, step.id);
    const owned = [...this.entries.values()].find(
      (entry) =>
        entry.active && entry.claim.run_id === run.run_id && entry.claim.step_id === step.id,
    );
    if (!state || !owned)
      throw new OperationalError(ErrorCode.PermissionDenied, RunnerMessage.FileClaim);
    if (paths.every((path) => writePaths(run, step).some((entry) => scopeCovers(entry, path))))
      return false;
    const combined = new Set([...(state.write_paths ?? []), ...paths]);
    const minimal = [...combined]
      .filter((path) => ![...combined].some((entry) => entry !== path && scopeCovers(entry, path)))
      .sort((left, right) => left.localeCompare(right));
    const parsed = FileWritePathsSchema.safeParse(minimal);
    if (
      !parsed.success ||
      (step.files?.length ?? 1) + parsed.data.length > RuntimeLimit.PendingOperations
    )
      throw new OperationalError(ErrorCode.Capacity, RunnerMessage.FileWriteClaims);
    const previous = state.write_paths;
    const format = run.schema_version;
    state.write_paths = parsed.data;
    if (run.schema_version < RunFormat.WriteClaims) run.schema_version = RunFormat.WriteClaims;
    try {
      await this.commit(run, RunEventKind.FileAccessRevised, {
        step_id: step.id,
        attempt: state.attempt,
        previous: owned.claim,
        write_paths: parsed.data,
      });
    } catch (error) {
      if (previous) state.write_paths = previous;
      else delete state.write_paths;
      run.schema_version = format;
      throw error;
    }
    return true;
  }

  private async retainReads(run: Run, step: Step): Promise<boolean> {
    if (!liveRun(run)) return false;
    const state = executionNode(run, step.id);
    const owned = [...this.entries.values()].find(
      (entry) =>
        entry.active && entry.claim.run_id === run.run_id && entry.claim.step_id === step.id,
    );
    if (!state || !owned)
      throw new OperationalError(ErrorCode.PermissionDenied, RunnerMessage.FileClaim);
    const paths = new Set(state.read_paths ?? []);
    for (const phase of Object.values(state.phases))
      for (const observation of phase.file_reads ?? []) {
        if (NativeFileField.Files in observation) paths.add(observation.directory);
        else if (!isSkillPath(run, observation.path)) paths.add(observation.path);
      }
    const minimal = paths.has(PathPart.Current)
      ? [PathPart.Current]
      : [...paths].filter((path) => !observedParent(path, paths));
    const reads = minimal
      .filter(
        (path) =>
          !owned.claim.paths.some((entry) =>
            filePathCovers(entry, resolve(owned.claim.project, path)),
          ),
      )
      .sort((left, right) => left.localeCompare(right));
    const admitted = [...owned.claim.paths, ...(owned.claim.read_paths ?? [])];
    if (
      reads.every((path) =>
        admitted.some((entry) => filePathCovers(entry, resolve(owned.claim.project, path))),
      )
    )
      return false;
    const parsed = FileReadPathsSchema.safeParse(reads);
    if (!parsed.success)
      throw new OperationalError(ErrorCode.Capacity, RunnerMessage.FileReadClaims);
    const previous = state.read_paths;
    const previousFormat = run.schema_version;
    state.read_paths = parsed.data;
    if (run.schema_version < RunFormat.ReadClaims) run.schema_version = RunFormat.ReadClaims;
    try {
      await this.commit(run, RunEventKind.FileAccessRevised, {
        step_id: step.id,
        attempt: state.attempt,
        previous: owned.claim,
        read_paths: state.read_paths,
      });
    } catch (error) {
      if (previous) state.read_paths = previous;
      else delete state.read_paths;
      run.schema_version = previousFormat;
      throw error;
    }
    return true;
  }

  async bind(
    run: Run,
    step: Step,
    input: FileExecutionOrigin,
  ): Promise<FileExecutionClaim | undefined> {
    if (!liveRun(run)) return undefined;
    const origin = FileExecutionOriginSchema.parse(input);
    const state = executionNode(run, step.id);
    const phase = state?.phases[origin.phase];
    const owned = [...this.entries.values()].find(
      (entry) =>
        entry.active && entry.claim.run_id === run.run_id && entry.claim.step_id === step.id,
    );
    if (
      !owned ||
      !phase ||
      phase.completed ||
      state?.state !== StepStatus.Running ||
      origin.step_id !== step.id ||
      state.attempt !== origin.attempt ||
      owned.claim.attempt !== origin.attempt
    )
      throw new OperationalError(ErrorCode.PermissionDenied, RunnerMessage.FileClaim);
    const binding = FileExecutionClaimSchema.parse({
      ...owned.claim,
      phase: origin.phase,
      execution_id: origin.execution_id,
    });
    const previous = phase.file_claim;
    const previousExecution = phase.execution_id;
    phase.file_claim = binding;
    phase.execution_id = binding.execution_id;
    try {
      await this.commit(run, RunEventKind.FileAccessBound, binding);
    } catch (error) {
      if (previous) phase.file_claim = previous;
      else delete phase.file_claim;
      phase.execution_id = previousExecution;
      throw error;
    }
    return binding;
  }

  validate(run: Run, execution: ScriptExecution): void {
    if (!liveRun(run)) return;
    const state = executionNode(run, execution.step_id);
    const checkpoint = state?.phases[execution.phase];
    const expected = checkpoint?.file_claim;
    const parsed = FileExecutionClaimSchema.safeParse(execution.file_claim);
    if (!parsed.success)
      throw new OperationalError(ErrorCode.PermissionDenied, RunnerMessage.FileClaim);
    const binding = parsed.data;
    const { phase, execution_id, ...claim } = binding;
    const owned = [...this.entries.values()].find(
      (entry) => entry.active && entry.claim.claim_id === binding.claim_id,
    );
    if (
      !owned ||
      state?.state !== StepStatus.Running ||
      state.attempt !== execution.attempt ||
      checkpoint?.completed ||
      checkpoint?.execution_id !== execution.execution_id ||
      binding.run_id !== run.run_id ||
      binding.step_id !== execution.step_id ||
      binding.attempt !== execution.attempt ||
      phase !== execution.phase ||
      execution_id !== execution.execution_id ||
      JSON.stringify(expected) !== JSON.stringify(binding) ||
      JSON.stringify(owned.claim) !== JSON.stringify(claim)
    )
      throw new OperationalError(ErrorCode.PermissionDenied, RunnerMessage.FileClaim);
  }

  async use<T>(run: Run, step: Step, signal: AbortSignal, work: AsyncTask<T>): Promise<T> {
    signal.throwIfAborted();
    if (!liveRun(run)) return work();
    const { key, claim, waiter, ready, waiting, owners } = await this.admission.use(
      FileAccessQueue,
      () => this.admit(run, step, signal),
    );
    const abort = (): void => {
      if (waiter.active) return;
      this.entries.delete(key);
      waiter.start();
      this.pump();
    };
    signal.addEventListener(SignalEvent.Abort, abort, { once: true });
    let acquired = false;
    try {
      signal.throwIfAborted();
      if (waiting)
        await this.commit(run, RunEventKind.FileAccessWaiting, {
          ...claim,
          owners,
        });
      await ready;
      signal.throwIfAborted();
      await this.commit(run, RunEventKind.FileAccessAcquired, claim);
      acquired = true;
      signal.throwIfAborted();
      await captureWriteInput(run, step, this.commit);
      signal.throwIfAborted();
      return await work();
    } finally {
      signal.removeEventListener(SignalEvent.Abort, abort);
      try {
        await this.commit(
          run,
          acquired ? RunEventKind.FileAccessReleased : RunEventKind.FileAccessWithdrawn,
          claim,
        );
      } finally {
        this.entries.delete(key);
        this.pump();
      }
    }
  }
}
