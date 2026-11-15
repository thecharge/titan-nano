import {
  ApprovalLevel,
  ApprovalRank,
  BoardDecision,
  BoardParty,
  ErrorCode,
  IoLimit,
  RequestDecision,
  RequestDefaults,
  RequestExecutionCheck,
  RequestFormat,
  RequestKind,
  RequestLimit,
  RequestProjection,
  RequestVersion,
  RunEventKind,
  RunFormat,
  RunStatus,
  StepStatus,
} from "@titan/constants";
import { assertSafeId, hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { RequestMessage, requestAlreadyAnswered } from "@titan/messages";
import { KeyedQueue } from "@titan/store";
import { jsonByteLength } from "@titan/streams";
import {
  ApprovalPolicySchema,
  type OperationRequest,
  type OperationRequestInput,
  OperationRequestInputSchema,
  OperationRequestSchema,
  type OperationScope,
  OperationScopeSchema,
  type RequestActor,
  RequestActorSchema,
  type RequestAnswerInput,
  RequestAnswerInputSchema,
  type RequestEscalationInput,
  RequestEscalationInputSchema,
  type RequestInventory,
  type RequestJournalPort,
  type RequestLedgerOptionsInput,
  RequestLedgerOptionsSchema,
  type RequestProjectionDocument,
  RequestProjectionSchema,
  RequestTurnBatchSchema,
  type RequestTurnCommit,
  type Run,
  type RunEvent,
  type StoreClock,
} from "@titan/types";

export function requestExecutionMatches(
  input: OperationRequestInput,
  run: Run,
  check = RequestExecutionCheck.History,
): boolean {
  const execution = input.origin.execution;
  if (!execution) return true;
  const node = run.nodes[execution.step_id];
  const phase = node?.phases[execution.phase];
  return (
    run.state === RunStatus.Running &&
    run.client_id === input.origin.client_id &&
    (check === RequestExecutionCheck.Waiting
      ? node?.state === StepStatus.Waiting &&
        phase?.request_turn?.waiting === true &&
        phase.request_turn.request_ids.includes(input.request_id)
      : node?.state === StepStatus.Running) &&
    node?.attempt === execution.attempt &&
    phase?.completed === false &&
    phase.executions > 0 &&
    phase.execution_id === execution.execution_id &&
    phase.session_id !== null &&
    phase.session_id === input.origin.harness_session_id &&
    (check !== RequestExecutionCheck.Admission ||
      (phase.error === null && phase.next_retry === null && phase.request_turn?.waiting !== true))
  );
}

function bounded(value: unknown): boolean {
  try {
    jsonByteLength(value, RequestLimit.InputBytes);
    return true;
  } catch {
    return false;
  }
}

function creationIdentity(input: OperationRequestInput): string {
  const { request_id, kind, scope, origin, expires_at } = input;
  return hash(JSON.stringify({ request_id, kind, scope, origin, expires_at }));
}

function identity(request: OperationRequest): string {
  return hash(
    JSON.stringify({
      ...request,
      schema_version: request.origin.execution ? RequestFormat.Execution : RequestFormat.Legacy,
      version: RequestVersion.Open,
      answer: null,
    }),
  );
}

function validAnswer(request: OperationRequest): boolean {
  const answer = request.answer;
  return (
    answer !== null &&
    answer.decided_at >= (request.escalation?.escalated_at ?? request.created_at) &&
    answer.decided_at < request.expires_at &&
    ApprovalRank[answer.actor.authority] >= ApprovalRank[request.level]
  );
}

function validEscalation(previous: OperationRequest, request: OperationRequest): boolean {
  return (
    previous.answer === null &&
    previous.escalation === undefined &&
    previous.level === ApprovalLevel.Main &&
    request.answer === null &&
    request.escalation !== undefined &&
    request.level === ApprovalLevel.Human &&
    request.version === previous.version + 1 &&
    request.created_at === previous.created_at &&
    creationIdentity(request) === creationIdentity(previous)
  );
}

function existingCreation(
  input: OperationRequestInput,
  requests: readonly OperationRequest[],
): OperationRequest | undefined {
  const existing = requests.find((request) => request.request_id === input.request_id);
  if (existing && creationIdentity(existing) !== creationIdentity(input))
    throw new TitanError(ErrorCode.RequestConflict, RequestMessage.Conflict);
  return existing;
}

function turnRecord(
  input: OperationRequestInput,
  inventory: RequestInventory,
  snapshot: Run,
  now: number,
): OperationRequest {
  const existing = existingCreation(input, inventory.requests);
  if (existing) return existing;
  if (!requestExecutionMatches(input, snapshot, RequestExecutionCheck.Admission))
    throw new TitanError(ErrorCode.PermissionDenied, RequestMessage.Execution);
  if (input.expires_at <= now)
    throw new TitanError(ErrorCode.RequestExpired, RequestMessage.Expired);
  return OperationRequestSchema.parse({
    ...input,
    schema_version: RequestFormat.Execution,
    run_id: inventory.run_id,
    version: RequestVersion.Open,
    level: inventory.approvals[input.kind],
    created_at: now,
    answer: null,
  });
}

function assertBoundedRequest(request: OperationRequest): void {
  if (!bounded(request)) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
}

export class RequestLedger {
  private options;
  private operations: KeyedQueue;
  constructor(
    private port: RequestJournalPort,
    options: RequestLedgerOptionsInput = {},
    private clock: StoreClock = Date.now,
  ) {
    this.options = RequestLedgerOptionsSchema.parse(options);
    this.operations = new KeyedQueue(this.options.max_pending_operations);
  }

  private fold(
    records: Map<string, OperationRequest>,
    event: RunEvent,
    inventory: RequestInventory,
    turn = false,
  ): void {
    if (event.type === RunEventKind.RequestTurnOpened) {
      try {
        jsonByteLength(event.data, IoLimit.DataBytes);
      } catch {
        throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
      }
      const batch = RequestTurnBatchSchema.safeParse(event.data);
      if (!batch.success || event.state.schema_version < RunFormat.RequestTurns)
        throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
      const origin = batch.data[0]?.origin.execution;
      const phase = origin ? event.state.nodes[origin.step_id]?.phases[origin.phase] : undefined;
      if (
        !phase?.request_turn ||
        phase.request_turn.execution_id !== origin?.execution_id ||
        JSON.stringify(phase.request_turn.request_ids) !==
          JSON.stringify(batch.data.map((request) => request.request_id))
      )
        throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
      for (const request of batch.data)
        this.fold(
          records,
          { ...event, type: RunEventKind.RequestOpened, data: request },
          inventory,
          true,
        );
      return;
    }
    const runId = inventory.run_id;
    if (
      event.type !== RunEventKind.RequestOpened &&
      event.type !== RunEventKind.RequestAnswered &&
      event.type !== RunEventKind.RequestEscalated
    )
      return;
    if (!bounded(event.data)) throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
    const parsed = OperationRequestSchema.safeParse(event.data);
    if (
      !parsed.success ||
      parsed.data.run_id !== runId ||
      event.state.run_id !== runId ||
      event.state.config.hash !== inventory.config_hash
    )
      throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
    const request = parsed.data;
    if (
      request.schema_version === RequestFormat.Persona &&
      event.state.schema_version < RunFormat.PersonaAnswers
    )
      throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
    const previous = records.get(request.request_id);
    const opening = event.type === RunEventKind.RequestOpened;
    const escalating = event.type === RunEventKind.RequestEscalated;
    if (
      request.level !==
        (request.escalation === undefined
          ? inventory.approvals[request.kind]
          : ApprovalLevel.Human) ||
      (opening && (previous || request.answer !== null || request.escalation !== undefined)) ||
      (opening &&
        (!requestExecutionMatches(
          request,
          event.state,
          turn ? RequestExecutionCheck.Waiting : RequestExecutionCheck.History,
        ) ||
          (request.schema_version === RequestFormat.Execution &&
            event.state.schema_version < RunFormat.ExecutionRequests))) ||
      (escalating && (!previous || !validEscalation(previous, request))) ||
      (!opening &&
        !escalating &&
        (!previous ||
          previous.answer !== null ||
          request.version !== previous.version + 1 ||
          identity(previous) !== identity(request) ||
          !validAnswer(request)))
    )
      throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
    if (opening && records.size >= inventory.max_requests)
      throw new TitanError(ErrorCode.Capacity, RequestMessage.Capacity);
    records.set(request.request_id, request);
  }

  private async scan(snapshot: Run, events: AsyncIterable<RunEvent>): Promise<RequestInventory> {
    const runId = assertSafeId(snapshot.run_id);
    const inventory: RequestInventory = {
      run_id: runId,
      config_hash: snapshot.config.hash,
      max_requests: Math.min(
        this.options.max_requests,
        snapshot.config.value.requests?.max_per_run ?? RequestLimit.PerRun,
      ),
      approvals: ApprovalPolicySchema.parse(snapshot.config.value.approvals ?? RequestDefaults),
      requests: [],
    };
    const records = new Map<string, OperationRequest>();
    for await (const event of events) this.fold(records, event, inventory);
    inventory.requests = [...records.values()];
    return inventory;
  }

  private async inventory(runId: string): Promise<RequestInventory> {
    assertSafeId(runId);
    const snapshot = await this.port.snapshot(runId);
    if (snapshot.run_id !== runId)
      throw new TitanError(ErrorCode.CorruptBoard, RequestMessage.Corrupt);
    return this.scan(snapshot, this.port.events(runId, snapshot.version));
  }

  async projection(
    snapshot: Run,
    events: AsyncIterable<RunEvent>,
  ): Promise<RequestProjectionDocument> {
    const inventory = await this.scan(snapshot, events);
    return RequestProjectionSchema.parse({
      schema_version: RequestProjection.Version,
      run_id: snapshot.run_id,
      through: snapshot.version,
      requests: inventory.requests.filter((request) => request.answer === null),
    });
  }

  async list(runId: string): Promise<OperationRequest[]> {
    return (await this.inventory(runId)).requests;
  }

  async open(runId: string, input: OperationRequestInput): Promise<OperationRequest> {
    assertSafeId(runId);
    if (!bounded(input)) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
    const parsed = OperationRequestInputSchema.safeParse(input);
    if (!parsed.success) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
    return this.operations.use(runId, async () => {
      const inventory = await this.inventory(runId);
      const records = inventory.requests;
      const existing = existingCreation(parsed.data, records);
      if (existing) return existing;
      if (records.length >= inventory.max_requests)
        throw new TitanError(ErrorCode.Capacity, RequestMessage.Capacity);
      const now = this.clock();
      if (parsed.data.expires_at <= now)
        throw new TitanError(ErrorCode.RequestExpired, RequestMessage.Expired);
      const request = OperationRequestSchema.parse({
        ...parsed.data,
        schema_version: parsed.data.origin.execution
          ? RequestFormat.Execution
          : RequestFormat.Legacy,
        run_id: runId,
        version: RequestVersion.Open,
        level: inventory.approvals[parsed.data.kind],
        created_at: now,
        answer: null,
      });
      if (!bounded(request)) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
      if (
        request.origin.execution &&
        !requestExecutionMatches(
          request,
          await this.port.snapshot(runId),
          RequestExecutionCheck.Admission,
        )
      )
        throw new TitanError(ErrorCode.PermissionDenied, RequestMessage.Execution);
      await this.port.append(runId, RunEventKind.RequestOpened, request);
      return request;
    });
  }

  async openTurn(
    runId: string,
    inputs: OperationRequestInput[],
    publish: RequestTurnCommit,
  ): Promise<OperationRequest[]> {
    assertSafeId(runId);
    jsonByteLength(inputs, IoLimit.DataBytes);
    const parsed = OperationRequestInputSchema.array()
      .min(1)
      .max(RequestLimit.PerRun)
      .parse(inputs);
    return this.operations.use(runId, async () => {
      const inventory = await this.inventory(runId);
      const snapshot = await this.port.snapshot(runId);
      const now = this.clock();
      const records = parsed.map((input) => turnRecord(input, inventory, snapshot, now));
      const batch = RequestTurnBatchSchema.parse(records);
      jsonByteLength(batch, IoLimit.DataBytes);
      const retained = batch.filter((request) =>
        inventory.requests.some((existing) => existing.request_id === request.request_id),
      ).length;
      if (retained === batch.length) return batch;
      if (retained > 0) throw new TitanError(ErrorCode.RequestConflict, RequestMessage.Conflict);
      if (inventory.requests.length + batch.length > inventory.max_requests)
        throw new TitanError(ErrorCode.Capacity, RequestMessage.Capacity);
      for (const request of batch) assertBoundedRequest(request);
      await publish(batch);
      return batch;
    });
  }

  async answer(input: RequestAnswerInput, actor: RequestActor): Promise<OperationRequest> {
    if (!bounded(input) || !bounded(actor))
      throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
    const parsed = RequestAnswerInputSchema.safeParse(input);
    const principal = RequestActorSchema.safeParse(actor);
    if (!parsed.success || !principal.success)
      throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
    const answer = parsed.data;
    return this.operations.use(answer.run_id, async () => {
      const request = (await this.list(answer.run_id)).find(
        (entry) => entry.request_id === answer.request_id,
      );
      if (!request) throw new TitanError(ErrorCode.RequestNotFound, RequestMessage.Missing);
      if (request.answer !== null)
        throw new TitanError(ErrorCode.RequestConflict, requestAlreadyAnswered(request.request_id));
      if (request.version !== answer.version)
        throw new TitanError(ErrorCode.RequestConflict, RequestMessage.Conflict);
      const now = this.clock();
      if (
        now < (request.escalation?.escalated_at ?? request.created_at) ||
        now >= request.expires_at
      )
        throw new TitanError(ErrorCode.RequestExpired, RequestMessage.Expired);
      if (ApprovalRank[principal.data.authority] < ApprovalRank[request.level])
        throw new TitanError(ErrorCode.PermissionDenied, RequestMessage.Permission);
      const candidate = OperationRequestSchema.safeParse({
        ...request,
        ...(answer.persona ? { schema_version: RequestFormat.Persona } : {}),
        version: request.version + 1,
        answer: {
          decision: answer.decision,
          reason: answer.reason,
          actor: principal.data,
          decided_at: now,
          ...(answer.persona ? { persona: answer.persona } : {}),
        },
      });
      if (!candidate.success)
        throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
      const decided = candidate.data;
      if (!bounded(decided)) throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
      await this.port.append(answer.run_id, RunEventKind.RequestAnswered, decided);
      return decided;
    });
  }

  async decideWithinLimits(runId: string, requestId: string): Promise<OperationRequest> {
    assertSafeId(runId);
    const request = (await this.list(runId)).find((entry) => entry.request_id === requestId);
    if (!request) throw new TitanError(ErrorCode.RequestNotFound, RequestMessage.Missing);
    const snapshot = await this.port.snapshot(runId);
    if (
      request.kind !== RequestKind.AddStep ||
      request.level !== ApprovalLevel.Auto ||
      request.answer !== null ||
      snapshot.plan.nodes.length + 1 > snapshot.config.value.limits.max_steps
    )
      throw new TitanError(ErrorCode.PermissionDenied, RequestMessage.OutsideLimits);
    const decided = await this.answer(
      {
        run_id: runId,
        request_id: requestId,
        version: request.version,
        decision: RequestDecision.Approve,
        reason: BoardDecision.WithinLimits,
      },
      { client_id: BoardParty.Titan, authority: ApprovalLevel.Auto },
    );
    await this.port.append(runId, RunEventKind.Decision, decided);
    return decided;
  }

  async escalate(input: RequestEscalationInput, actor: RequestActor): Promise<OperationRequest> {
    if (!bounded(input) || !bounded(actor))
      throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
    const parsed = RequestEscalationInputSchema.safeParse(input);
    const principal = RequestActorSchema.safeParse(actor);
    if (!parsed.success || !principal.success)
      throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
    const selection = parsed.data;
    return this.operations.use(selection.run_id, async () => {
      const request = (await this.list(selection.run_id)).find(
        (entry) => entry.request_id === selection.request_id,
      );
      if (!request) throw new TitanError(ErrorCode.RequestNotFound, RequestMessage.Missing);
      if (request.answer !== null || request.version !== selection.version)
        throw new TitanError(ErrorCode.RequestConflict, RequestMessage.Conflict);
      if (request.level !== ApprovalLevel.Main || principal.data.authority === ApprovalLevel.Auto)
        throw new TitanError(ErrorCode.PermissionDenied, RequestMessage.Escalation);
      const now = this.clock();
      if (now < request.created_at || now >= request.expires_at)
        throw new TitanError(ErrorCode.RequestExpired, RequestMessage.Expired);
      const escalated = OperationRequestSchema.parse({
        ...request,
        version: request.version + 1,
        level: ApprovalLevel.Human,
        escalation: { reason: selection.reason, actor: principal.data, escalated_at: now },
      });
      if (!bounded(escalated))
        throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
      await this.port.append(selection.run_id, RunEventKind.RequestEscalated, escalated);
      return escalated;
    });
  }

  async approved(
    runId: string,
    requestId: string,
    kind: RequestKind,
    scope: OperationScope,
  ): Promise<OperationRequest> {
    const request = (await this.list(runId)).find((entry) => entry.request_id === requestId);
    const parsed = bounded(scope) ? OperationScopeSchema.safeParse(scope) : null;
    const now = this.clock();
    if (
      !request ||
      request.kind !== kind ||
      !parsed?.success ||
      request.answer?.decision !== RequestDecision.Approve ||
      now < request.answer.decided_at ||
      now >= request.expires_at ||
      hash(JSON.stringify(parsed.data)) !== hash(JSON.stringify(request.scope))
    )
      throw new TitanError(ErrorCode.PermissionDenied, RequestMessage.Scope);
    return request;
  }
}
