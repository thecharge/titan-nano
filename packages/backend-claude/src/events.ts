import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { AgentEventKind, ClaudeEventKind, ErrorCode, SdkArgumentField } from "@titan/constants";
import { emptyUsage, retainSessionId } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { ClaudeMessage, claudeErrors } from "@titan/messages";
import type { EventSink, SessionIdSink } from "@titan/types";
import {
  type AgentAnswer,
  type AgentEvent,
  ClaudeCreditFailureSchema,
  ClaudeUsageSchema,
} from "@titan/types/agents";
import { claudeRetry } from "./recovery.ts";

function claudeEvent(event: SDKMessage, prior: string | null): AgentEvent {
  const session_id =
    SdkArgumentField.SessionId in event
      ? retainSessionId(prior, event.session_id, ClaudeMessage.SessionChanged)
      : prior;
  return {
    type:
      event.type === ClaudeEventKind.System
        ? AgentEventKind.Session
        : event.type === ClaudeEventKind.Result
          ? AgentEventKind.Usage
          : AgentEventKind.Message,
    session_id,
    data: event,
  };
}

function claudeAnswer(event: SDKMessage, sessionId: string | null): AgentAnswer | undefined {
  if (ClaudeCreditFailureSchema.safeParse(event).success)
    throw new OperationalError(ErrorCode.QuotaExhausted, ClaudeMessage.QuotaExhausted);
  if (event.type === ClaudeEventKind.System && event.subtype === ClaudeEventKind.ApiRetry)
    throw claudeRetry(event);
  if (event.type !== ClaudeEventKind.Result) return undefined;
  if (event.subtype !== ClaudeEventKind.Success || event.is_error)
    throw new OperationalError(
      ErrorCode.ClaudeExecution,
      event.subtype === ClaudeEventKind.Success ? event.result : claudeErrors(event.errors),
    );
  if (!sessionId) throw new OperationalError(ErrorCode.ClaudeSession, ClaudeMessage.MissingSession);
  const observed = ClaudeUsageSchema.safeParse(event);
  if (!observed.success)
    throw new OperationalError(ErrorCode.ClaudeProtocol, ClaudeMessage.InvalidUsage);
  const usage = emptyUsage();
  usage.input_tokens = Object.values(observed.data.modelUsage).reduce(
    (sum, item) => sum + item.inputTokens,
    0,
  );
  usage.output_tokens = Object.values(observed.data.modelUsage).reduce(
    (sum, item) => sum + item.outputTokens,
    0,
  );
  usage.cost_usd = observed.data.total_cost_usd;
  return {
    text: event.result,
    json: event.structured_output ?? null,
    session_id: sessionId,
    usage,
  };
}

export async function claudeTurn(
  stream: Query,
  sink: EventSink,
  signal: AbortSignal,
  initial: string | null,
  retain: SessionIdSink,
): Promise<AgentAnswer> {
  let sessionId = initial;
  for await (const event of stream) {
    signal.throwIfAborted();
    const frame = claudeEvent(event, sessionId);
    sessionId = frame.session_id;
    retain(sessionId);
    await sink(frame);
    signal.throwIfAborted();
    const answer = claudeAnswer(event, sessionId);
    if (answer) return answer;
  }
  throw new OperationalError(ErrorCode.ClaudeIncomplete, ClaudeMessage.Incomplete);
}
