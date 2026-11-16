import { resolve } from "node:path";
import { atomicWrite, initialPhase } from "@titan/board";
import {
  AgentTool,
  BoardParty,
  BoardPostKind,
  ErrorCode,
  ExecutionDelivery,
  ExecutionPhase,
  FalsifierOutput,
  FileEncoding,
  IoLimit,
  Newline,
  PathPart,
  RequestDecision,
  RequestKind,
  RunEventKind,
  RunFile,
  SignalEvent,
  StepStatus,
  TextSymbol,
  WorkflowField,
} from "@titan/constants";
import { limitDelay, newId } from "@titan/core";
import { classifyError, errorMessage, OperationalError, UsageLimitError } from "@titan/errors";
import {
  executionFailure,
  invocationId,
  RequestTurnMessage,
  RunnerMessage,
  unknownRequestKind,
} from "@titan/messages";
import { jsonBytes } from "@titan/streams";
import {
  type AgentEvent,
  AgentKindProbeSchema,
  type AgentSpec,
  AgentTurnSchema,
  type AsyncTask,
  type BackendFactory,
  FalsifierAnswerSchema,
  type NativeToolExecutionOwner,
  type OperationRequest,
  type Persona,
  type PhaseContext,
  type PhaseExecution,
  type PhaseTurn,
  type RequestTurnLedgerProvider,
  type RequestTurnPublisher,
  type Run,
  type RunCommit,
  type StepListing,
} from "@titan/types";
import {
  checkAnswer,
  outputSchema,
  personaAction,
  requestTurnOutputSchema,
  resolvedPersona,
} from "@titan/workflow";
import { readTree, treeHash, writeTree } from "@titan/workspace";
import { personaBackend } from "./backend-choice.ts";
import type { Capacity } from "./capacity.ts";
import { accessMode, type FileAccess } from "./file-access.ts";
import { writePaths } from "./file-scope.ts";
import { HelperTurns } from "./helper-turns.ts";
import { liveRun } from "./live.ts";
import { effectiveModel } from "./models.ts";
import { ExecutionTools, isWorkerKey } from "./native-execution.ts";
import { verifyNativeReads } from "./native-files.ts";
import { assertCaptured, receiveWorker, sealWorker } from "./received.ts";
import type { RunHubFlow } from "./run-hub-flow.ts";

function grantedTools(context: PhaseExecution): string[] {
  return context.request_answers
    .filter(
      (request) =>
        request.kind === RequestKind.Tool && request.answer?.decision === RequestDecision.Approve,
    )
    .map((request) => request.scope.resource);
}

function specification(
  context: PhaseExecution,
  persona: Persona,
  personaId: string,
  hubTools: readonly string[],
): AgentSpec {
  const tools = [...new Set([...persona.tools, ...grantedTools(context), ...hubTools])];
  return {
    persona_id: personaId,
    attempt: context.state.attempt,
    execution: context.phase.executions + 1,
    run_id: context.run.run_id,
    invocation_id: invocationId(context.step.id, context.state.attempt, context.key),
    execution_id: context.execution_id,
    cwd: context.file_claim?.project ?? context.cwd,
    ...(liveRun(context.run)
      ? {
          file_scope: {
            ...(context.file_claim ? { claim: context.file_claim } : {}),
            mode: accessMode(context.run, context.step),
            paths: writePaths(context.run, context.step),
            ...(context.run.runtime_paths?.length
              ? { exclude_paths: context.run.runtime_paths }
              : {}),
            ...(context.state.read_paths ? { read_paths: context.state.read_paths } : {}),
          },
        }
      : {}),
    role: persona.request_turns
      ? `${persona.role}${Newline}${RequestTurnMessage.Role}`
      : persona.role,
    model: effectiveModel(persona, context.run.config.value.defaults),
    tools,
    output_schema: persona.request_turns
      ? requestTurnOutputSchema(isWorkerKey(context.key) ? outputSchema(persona) : FalsifierOutput)
      : isWorkerKey(context.key)
        ? outputSchema(persona)
        : FalsifierOutput,
    writable:
      isWorkerKey(context.key) &&
      tools.some((tool) => tool === AgentTool.Write || tool === AgentTool.Edit),
    max_turns: context.run.config.value.defaults.claude_max_turns,
  };
}

function validateAnswer(context: PhaseExecution, persona: Persona, value: unknown): void {
  if (!isWorkerKey(context.key)) {
    if (!FalsifierAnswerSchema.safeParse(value).success)
      throw new OperationalError(ErrorCode.CheckerProtocol, RunnerMessage.InvalidVerdict, true);
    return;
  }
  try {
    checkAnswer(persona, value);
  } catch {
    throw new OperationalError(ErrorCode.WorkerOutput, RunnerMessage.WorkerOutput);
  }
}

function stepList(run: Run): StepListing[] {
  return run.plan.nodes.map((node) => {
    const action = personaAction(node.do);
    return {
      id: node.id,
      task: action?.task ?? TextSymbol.Empty,
      persona: action?.persona ?? TextSymbol.Empty,
      state: run.nodes[node.id]?.state ?? StepStatus.Pending,
    };
  });
}

function attemptFolder(context: PhaseExecution): string {
  return context.folder ?? resolve(context.cwd, PathPart.Parent);
}

async function persistTask(context: PhaseExecution, task: string): Promise<string> {
  const { run, state, key } = context;
  const request_answers = context.request_answers.map((request) => ({
    request_id: request.request_id,
    kind: request.kind,
    answer: request.answer,
  }));
  const bytes = await jsonBytes(
    context.phase.helper
      ? { task, ...(request_answers.length ? { request_answers } : {}) }
      : {
          goal: run.plan.workflow.goal,
          task,
          inputs: context.inputs,
          ...(state.reconciliations
            ? {
                reconciliation: {
                  generation: state.reconciliations.length,
                  original_task:
                    personaAction(context.step.do)?.task ??
                    (WorkflowField.Script in context.step.do ? context.step.do.script : undefined),
                  original_input: state.input,
                  original_result: state.reconciliations[0]?.phases[ExecutionPhase.Worker]?.answer,
                  current_input: state.reconciliations.at(-1)?.input,
                  current_input_hash: state.reconciliations.at(-1)?.input_hash,
                  retained_result:
                    state.reconciliations.at(-1)?.phases[ExecutionPhase.Worker]?.answer,
                },
              }
            : {}),
          ...(request_answers.length ? { request_answers } : {}),
          ...(isWorkerKey(key)
            ? { prior_refutations: state.evidence, steps: stepList(run) }
            : {
                step_task: personaAction(context.step.do)?.task ?? TextSymbol.Empty,
                candidate: context.candidate,
              }),
        },
    IoLimit.DataBytes,
  );
  await atomicWrite(resolve(attemptFolder(context), `${key}${RunFile.TaskSuffix}`), bytes);
  return bytes.toString(FileEncoding.Utf8);
}

async function acceptedTurn(
  context: PhaseExecution,
  persona: Persona,
  value: unknown,
): Promise<PhaseTurn> {
  if (persona.request_turns) {
    await jsonBytes(value, IoLimit.DataBytes);
    const turn = AgentTurnSchema.parse(value);
    if (!turn.requests.length) validateAnswer(context, persona, turn.result);
    return { value: turn.result, requests: turn.requests };
  }
  validateAnswer(context, persona, value);
  return { value, requests: [] };
}

export class AgentPhases {
  private helpers: HelperTurns;
  constructor(
    private factory: BackendFactory,
    private capacity: Capacity,
    private commit: RunCommit,
    private requests: RequestTurnLedgerProvider,
    private publish: RequestTurnPublisher,
    private hub: RunHubFlow,
    private nativeTools?: NativeToolExecutionOwner,
    private clock: () => Date = () => new Date(),
    private files?: FileAccess,
  ) {
    this.helpers = new HelperTurns((context) => this.execute(context), requests, commit, clock);
  }

  async execute(context: PhaseContext, prepare?: AsyncTask<void>): Promise<unknown> {
    const { run, state, key, signal } = context;
    state.phases[key] ??= initialPhase();
    const phase = state.phases[key];
    if (phase.completed) return phase.answer;
    if (phase.helper?.received) {
      await verifyNativeReads(run, context.step, phase.file_reads ?? [], true, context.cwd);
      phase.completed = true;
      phase.error = null;
      await this.commit(run, RunEventKind.PhaseCompleted, {
        step_id: context.step.id,
        phase: key,
        execution_id: phase.execution_id,
      });
      return phase.answer;
    }
    assertCaptured(phase);
    const request_answers = await this.answers(context);
    if (await this.files?.reviseWrites(run, context.step, request_answers, isWorkerKey(key)))
      throw new OperationalError(ErrorCode.FileScopeChanged, RunnerMessage.FileScopeChanged);
    if (phase.executions > 0 && !phase.session_id && phase.delivery !== ExecutionDelivery.Prepared)
      throw new OperationalError(ErrorCode.SessionUnavailable, RunnerMessage.SessionUnavailable);
    if (
      phase.executions > 0 &&
      !phase.request_turn?.waiting &&
      phase.retries >= run.config.value.recovery.max_retries
    )
      throw new OperationalError(ErrorCode.RecoveryExhausted, RunnerMessage.RecoveryExhausted);
    signal.throwIfAborted();
    const execution: PhaseExecution = {
      ...context,
      phase,
      execution_id: newId(),
      request_answers,
    };
    try {
      const worker = personaAction(context.action);
      const persona = worker ? resolvedPersona(run.plan.workflow, worker.persona) : undefined;
      const backend = personaBackend(run, persona);
      const result = await this.capacity.use(
        run.run_id,
        signal,
        () => this.admitted(execution, prepare),
        {
          backend,
          max_parallel: run.config.value.limits.max_parallel,
        },
      );
      signal.throwIfAborted();
      if (result.requests.length) {
        const origin = {
          step_id: context.step.id,
          attempt: state.attempt,
          phase: key,
          execution_id: execution.execution_id,
        };
        await this.requests().openTurn(
          run.run_id,
          result.requests.map((request) => ({
            ...request,
            request_id: newId(),
            origin: {
              client_id: run.client_id,
              harness_session_id: phase.session_id,
              execution: origin,
            },
          })),
          (requests) => this.publish(execution, requests),
        );
        return this.execute(context, prepare);
      }
      phase.answer = result.value;
      delete phase.capture_pending;
      phase.completed = true;
      phase.error = null;
      await this.commit(run, RunEventKind.PhaseCompleted, {
        step_id: context.step.id,
        phase: key,
        execution_id: execution.execution_id,
      });
      return result.value;
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof OperationalError &&
          error.code === ErrorCode.RequestWaiting &&
          state.state === StepStatus.Waiting)
      )
        throw error;
      await this.recover(execution, error);
    }
  }

  private async admitted(context: PhaseExecution, prepare?: AsyncTask<void>): Promise<PhaseTurn> {
    const tools = new ExecutionTools(this.nativeTools);
    try {
      await prepare?.();
      context.file_claim = await this.files?.bind(context.run, context.step, {
        step_id: context.step.id,
        attempt: context.state.attempt,
        phase: context.key,
        execution_id: context.execution_id,
      });
      const turn = await this.turn(context, tools);
      await verifyNativeReads(
        context.run,
        context.step,
        context.phase.file_reads ?? [],
        isWorkerKey(context.key),
        context.cwd,
      );
      if (!turn.requests.length) await this.checkpoint(context, tools);
      return turn;
    } catch (error) {
      await tools.guard(errorMessage(error));
      throw error;
    } finally {
      await tools.close();
    }
  }

  private async answers(context: PhaseContext): Promise<OperationRequest[]> {
    const pending = context.state.phases[context.key]?.request_turn;
    if (!pending) return [];
    const records = await this.requests().list(context.run.run_id);
    const selected = pending.request_ids.map((id) =>
      records.find((request) => request.request_id === id),
    );
    if (selected.some((request) => request === undefined))
      throw new OperationalError(ErrorCode.CorruptBoard, RequestTurnMessage.Corrupt);
    const addressed = selected.filter(
      (request): request is OperationRequest => request !== undefined,
    );
    if (
      addressed.some(
        (request) =>
          request.origin.client_id !== context.run.client_id ||
          request.origin.harness_session_id !== context.state.phases[context.key]?.session_id ||
          request.origin.execution?.step_id !== context.step.id ||
          request.origin.execution.attempt !== context.state.attempt ||
          request.origin.execution.phase !== context.key ||
          request.origin.execution.execution_id !== pending.execution_id,
      )
    )
      throw new OperationalError(ErrorCode.CorruptBoard, RequestTurnMessage.Corrupt);
    const answers = await this.helpers.resolve(context, addressed);
    if (answers.some((request) => request.answer === null)) {
      context.state.state = StepStatus.Waiting;
      throw new OperationalError(ErrorCode.RequestWaiting, RequestTurnMessage.Waiting);
    }
    return answers;
  }

  private async recordEvent(context: PhaseExecution, event: AgentEvent): Promise<void> {
    if (context.phase.execution_id !== context.execution_id || context.signal.aborted) return;
    if (event.session_id) context.phase.session_id = event.session_id;
    await this.commit(context.run, RunEventKind.AgentEvent, {
      step_id: context.step.id,
      phase: context.key,
      execution_id: context.execution_id,
      ...event,
    });
  }

  private async guardedEvent(
    context: PhaseExecution,
    event: AgentEvent,
    tools: ExecutionTools,
  ): Promise<void> {
    if (tools.closed) return;
    await tools.guard(event);
    await this.recordEvent(context, tools.project(event));
  }

  private async turn(context: PhaseExecution, tools: ExecutionTools): Promise<PhaseTurn> {
    const { run, step, state, key, action, signal, phase, execution_id } = context;
    const worker = personaAction(action);
    const prompt = worker ? await persistTask(context, worker.task) : TextSymbol.Empty;
    signal.throwIfAborted();
    if (!worker)
      throw new OperationalError(ErrorCode.ScriptApprovalRequired, RunnerMessage.ScriptApproval);
    const persona = resolvedPersona(run.plan.workflow, worker.persona);
    const backend = this.factory(personaBackend(run, persona), run.config);
    if (phase.executions > 0 && !phase.session_id && phase.delivery !== ExecutionDelivery.Prepared)
      throw new OperationalError(ErrorCode.SessionUnavailable, RunnerMessage.Reconstruction);
    const spec = specification(
      context,
      persona,
      worker.persona,
      this.nativeTools ? [] : this.hub.tools(isWorkerKey(key)),
    );
    await backend.validateTurn?.(spec, prompt, phase.session_id);
    signal.throwIfAborted();
    if (phase.executions > 0 && !phase.request_turn?.waiting) phase.retries++;
    if (phase.request_turn) phase.request_turn.waiting = false;
    phase.dispatches ??= phase.executions;
    phase.executions++;
    phase.delivery = ExecutionDelivery.Prepared;
    phase.execution_id = execution_id;
    phase.next_retry = null;
    phase.error = null;
    await this.commit(run, RunEventKind.ExecutionStarted, {
      step_id: step.id,
      attempt: state.attempt,
      phase: key,
      execution_id,
    });
    tools.open(context);
    if (tools.binding) await backend.validateTurn?.(spec, prompt, phase.session_id, tools.binding);
    signal.throwIfAborted();
    phase.delivery = ExecutionDelivery.Uncertain;
    phase.dispatches++;
    await this.commit(run, RunEventKind.ExecutionDispatching, {
      step_id: step.id,
      attempt: state.attempt,
      phase: key,
      execution_id,
    });
    signal.throwIfAborted();
    const session = phase.session_id
      ? await backend.resume(phase.session_id, spec, tools.binding)
      : await backend.start(spec, tools.binding);
    const abort = (): void => {
      void session.cancel(RunnerMessage.Aborted).catch(() => {});
    };
    signal.addEventListener(SignalEvent.Abort, abort, { once: true });
    try {
      const answer = await session.send(
        prompt,
        (event) => this.guardedEvent(context, event, tools),
        signal,
      );
      signal.throwIfAborted();
      const delay = limitDelay(answer.text, this.clock());
      if (delay !== null) throw new UsageLimitError(RunnerMessage.UsageLimit, delay);
      await tools.guard(answer);
      phase.session_id = answer.session_id;
      phase.usage.push(answer.usage);
      const value: unknown = answer.json ?? answer.text;
      if (persona.request_turns) await this.refuseUnknownKinds(context, worker.persona, value);
      const accepted = await acceptedTurn(context, persona, value);
      if (key === ExecutionPhase.Worker && !accepted.requests.length)
        await receiveWorker(context, accepted.value, this.commit);
      if (phase.helper && !accepted.requests.length) {
        phase.answer = accepted.value;
        phase.helper.received = true;
        await this.commit(run, RunEventKind.PhaseReceived, {
          step_id: step.id,
          phase: key,
          execution_id,
        });
      }
      return accepted;
    } finally {
      signal.removeEventListener(SignalEvent.Abort, abort);
      await session.close();
    }
  }

  private async refuseUnknownKinds(
    context: PhaseExecution,
    personaId: string,
    value: unknown,
  ): Promise<void> {
    const probe = AgentKindProbeSchema.safeParse(value);
    if (!probe.success) return;
    const known: string[] = Object.values(RequestKind);
    const unknown = probe.data.requests.filter((request) => !known.includes(request.kind));
    for (const request of unknown)
      await this.commit(context.run, RunEventKind.RequestRefused, {
        from: personaId,
        to: BoardParty.Titan,
        kind: BoardPostKind.Refused,
        text: unknownRequestKind(request.kind),
      });
    if (unknown.length)
      throw new OperationalError(ErrorCode.WorkerOutput, RunnerMessage.WorkerOutput);
  }

  private async checkpoint(context: PhaseExecution, tools: ExecutionTools): Promise<void> {
    if (context.key !== ExecutionPhase.Worker) return;
    const limits = context.run.config.value.limits;
    const checkpoint = resolve(attemptFolder(context), RunFile.Candidate);
    await writeTree(
      checkpoint,
      await readTree(context.cwd, limits, tools.scanner, context.run.runtime_paths),
      limits,
      tools.scanner,
    );
    const checksum = await treeHash(await readTree(checkpoint, limits, tools.scanner));
    await atomicWrite(resolve(checkpoint, PathPart.Parent, RunFile.CandidateHash), checksum);
    await sealWorker(context, context.phase, checksum, this.commit);
  }

  private async recover(context: PhaseExecution, error: unknown): Promise<never> {
    const { run, phase, step, key } = context;
    const limits = run.config.value.recovery;
    const operational = classifyError(error);
    phase.error = executionFailure(operational.code, operational.message);
    if (operational instanceof UsageLimitError) phase.next_retry = Date.now() + operational.delayMs;
    else if (operational.retryable && operational.retryAfterMs > 0)
      phase.next_retry = Date.now() + operational.retryAfterMs;
    if (!operational.retryable || phase.retries >= limits.max_retries) {
      await this.commit(run, RunEventKind.ExecutionBlocked, {
        step_id: step.id,
        phase: key,
        reason: phase.error,
        next_retry: phase.next_retry,
      });
      throw operational;
    }
    const exponential = Math.min(limits.max_delay_s, limits.base_delay_s * 2 ** phase.retries);
    const delay = Math.max(
      operational.retryAfterMs,
      exponential * 1000 * (1 - limits.jitter_ratio + Math.random() * limits.jitter_ratio),
    );
    phase.next_retry = Date.now() + delay;
    await this.commit(run, RunEventKind.ExecutionRecovering, {
      step_id: step.id,
      phase: key,
      next_retry: phase.next_retry,
      reason: phase.error,
    });
    throw new OperationalError(ErrorCode.RecoveryScheduled, RunnerMessage.RecoveryScheduled);
  }
}
