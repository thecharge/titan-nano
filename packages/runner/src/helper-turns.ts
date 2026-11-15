import { initialPhase } from "@titan/board";
import {
  ApprovalLevel,
  BoardParty,
  ErrorCode,
  ExecutionPhase,
  Newline,
  RequestDecision,
  RequestKind,
  RunEventKind,
  RunFormat,
  SchemaKind,
  StepStatus,
} from "@titan/constants";
import { OperationalError, TitanError } from "@titan/errors";
import { RequestTurnMessage } from "@titan/messages";
import type {
  HelperTurnExecutor,
  OperationRequest,
  PhaseContext,
  RequestTurnLedgerProvider,
  RunCommit,
} from "@titan/types";
import { resolvedPersona } from "@titan/workflow";

export class HelperTurns {
  constructor(
    private execute: HelperTurnExecutor,
    private ledger: RequestTurnLedgerProvider,
    private commit: RunCommit,
    private clock: () => Date,
  ) {}

  async resolve(context: PhaseContext, requests: OperationRequest[]): Promise<OperationRequest[]> {
    const answers: OperationRequest[] = [];
    for (const request of requests) answers.push(await this.answer(context, request));
    return answers;
  }

  private async answer(
    context: PhaseContext,
    request: OperationRequest,
  ): Promise<OperationRequest> {
    if (
      request.kind !== RequestKind.Ask ||
      request.answer !== null ||
      (request.answer === null && request.level !== ApprovalLevel.Auto) ||
      request.expires_at <= this.clock().getTime()
    )
      return request;
    const key = ExecutionPhase.HelperPrefix + request.request_id;
    const selector = request.scope.resource;
    const persona = context.run.plan.workflow.personas[selector]
      ? selector
      : Object.keys(context.run.persona_references ?? {})
          .sort()
          .find((alias) => context.run.persona_references?.[alias] === selector);
    if (!persona) return request;
    if (!context.run.plan.workflow.personas[persona]) return request;
    resolvedPersona(context.run.plan.workflow, persona);
    const question = request.scope.arguments.join(Newline);
    if (!question.length)
      throw new OperationalError(ErrorCode.InvalidRequest, RequestTurnMessage.Corrupt);
    const state = context.state;
    const origin = request.origin.execution;
    const harness_session_id = request.origin.harness_session_id;
    if (!origin || !harness_session_id)
      throw new OperationalError(ErrorCode.CorruptBoard, RequestTurnMessage.Corrupt);
    const existing = state.phases[key];
    if (
      existing &&
      (existing.helper?.request_id !== request.request_id ||
        JSON.stringify(existing.helper.origin) !== JSON.stringify(origin) ||
        existing.helper.harness_session_id !== harness_session_id ||
        existing.helper.persona !== persona ||
        existing.helper.question !== question)
    )
      throw new OperationalError(ErrorCode.CorruptBoard, RequestTurnMessage.Corrupt);
    if (!existing) {
      state.phases[key] = {
        ...initialPhase(),
        helper: {
          request_id: request.request_id,
          origin,
          harness_session_id,
          persona,
          question,
          received: false,
        },
      };
      if (context.run.schema_version < RunFormat.HelperTurns)
        context.run.schema_version = RunFormat.HelperTurns;
      await this.commit(context.run, RunEventKind.HelperStarted, {
        step_id: context.step.id,
        phase: key,
        request_id: request.request_id,
      });
    }
    state.state = StepStatus.Running;
    const value = await this.execute({
      ...context,
      key,
      action: { persona, task: question },
      inputs: {},
      candidate: undefined,
    });
    context.signal.throwIfAborted();
    const reason = typeof value === SchemaKind.String ? String(value) : JSON.stringify(value);
    try {
      return await this.ledger().answer(
        {
          run_id: context.run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Approve,
          reason,
        },
        { client_id: BoardParty.Titan, authority: ApprovalLevel.Auto },
      );
    } catch (error) {
      if (!(error instanceof TitanError) || error.code !== ErrorCode.RequestConflict) throw error;
      const retained = (await this.ledger().list(context.run.run_id)).find(
        (entry) => entry.request_id === request.request_id,
      );
      if (!retained?.answer) throw error;
      return retained;
    }
  }
}
