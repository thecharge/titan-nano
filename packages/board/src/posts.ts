import {
  ApprovalLevel,
  BoardDecision,
  BoardPostKind,
  RunEventKind,
  TextSymbol,
} from "@titan/constants";
import {
  type BoardDecisionLine,
  BoardDecisionSchema,
  type BoardPersonaPicked,
  BoardPersonaPickedSchema,
  type BoardPost,
  BoardPostSchema,
  type BoardStepAdded,
  BoardStepAddedSchema,
  type OperationRequest,
  OperationRequestSchema,
  RequestAnswerSchema,
  RequestTurnBatchSchema,
  type RunEvent,
} from "@titan/types";

function openedPost(request: OperationRequest): BoardPost {
  return {
    from: request.origin.client_id,
    to: request.scope.resource,
    kind: request.kind,
    text: request.scope.arguments[0] ?? request.scope.operation,
  };
}

export function boardPost(event: RunEvent): BoardPost | undefined {
  if (event.type === RunEventKind.RequestRefused) return BoardPostSchema.parse(event.data);
  if (event.type === RunEventKind.RequestOpened)
    return openedPost(OperationRequestSchema.parse(event.data));
  if (event.type === RunEventKind.RequestAnswered) {
    const request = OperationRequestSchema.parse(event.data);
    return {
      from: request.scope.resource,
      to: request.origin.client_id,
      kind: BoardPostKind.Answer,
      text: request.answer?.reason ?? TextSymbol.Empty,
    };
  }
  return undefined;
}

export function boardDecision(event: RunEvent): BoardDecisionLine | undefined {
  if (event.type !== RunEventKind.Decision) return undefined;
  const request = OperationRequestSchema.parse(event.data);
  const answer = RequestAnswerSchema.parse(request.answer);
  const alone = answer.actor.authority === ApprovalLevel.Auto;
  return BoardDecisionSchema.parse({
    kind: BoardDecision.Kind,
    request_id: request.request_id,
    level: request.level,
    by: answer.actor.client_id,
    answer: answer.decision,
    reason: answer.reason,
    rule: alone ? answer.reason : undefined,
  });
}

export async function boardDecisions(
  events: AsyncIterable<RunEvent>,
): Promise<BoardDecisionLine[]> {
  const lines: BoardDecisionLine[] = [];
  for await (const event of events) {
    const line = boardDecision(event);
    if (line) lines.push(line);
  }
  return lines;
}

export async function boardStepAdds(events: AsyncIterable<RunEvent>): Promise<BoardStepAdded[]> {
  const lines: BoardStepAdded[] = [];
  for await (const event of events)
    if (event.type === RunEventKind.StepAdded) lines.push(BoardStepAddedSchema.parse(event.data));
  return lines;
}

export async function boardPersonaPicks(
  events: AsyncIterable<RunEvent>,
): Promise<BoardPersonaPicked[]> {
  const lines: BoardPersonaPicked[] = [];
  for await (const event of events)
    if (event.type === RunEventKind.PersonaPicked)
      lines.push(BoardPersonaPickedSchema.parse(event.data));
  return lines;
}

export async function boardPosts(events: AsyncIterable<RunEvent>): Promise<BoardPost[]> {
  const posts: BoardPost[] = [];
  for await (const event of events) {
    if (event.type === RunEventKind.RequestTurnOpened)
      posts.push(...RequestTurnBatchSchema.parse(event.data).map(openedPost));
    const post = boardPost(event);
    if (post) posts.push(post);
  }
  return posts;
}
