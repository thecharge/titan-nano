import type { ThreadEvent } from "@openai/codex-sdk";
import { AgentEventKind, CodexEventKind, ErrorCode } from "@titan/constants";
import { retainSessionId } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { CodexMessage } from "@titan/messages";
import type { CodexTurnState } from "@titan/types";
import {
  type AgentAnswer,
  type AgentEvent,
  type AgentSpec,
  UsageSchema,
} from "@titan/types/agents";

export function codexEvent(state: CodexTurnState, event: ThreadEvent): AgentEvent {
  if (event.type === CodexEventKind.ThreadStarted)
    state.session_id = retainSessionId(
      state.session_id,
      event.thread_id,
      CodexMessage.SessionChanged,
    );
  if (
    event.type === CodexEventKind.ItemCompleted &&
    event.item.type === CodexEventKind.AgentMessage
  )
    state.text = event.item.text;
  if (event.type === CodexEventKind.TurnCompleted) {
    state.complete = true;
    const usage = UsageSchema.safeParse({
      input_tokens: event.usage.input_tokens,
      output_tokens: event.usage.output_tokens,
      cost_usd: null,
    });
    if (!usage.success)
      throw new OperationalError(ErrorCode.CodexProtocol, CodexMessage.InvalidUsage);
    state.usage = usage.data;
  }
  return {
    type:
      event.type === CodexEventKind.ThreadStarted
        ? AgentEventKind.Session
        : event.type === CodexEventKind.TurnCompleted
          ? AgentEventKind.Usage
          : AgentEventKind.Message,
    session_id: state.session_id,
    data: event,
  };
}

export function assertCodexEvent(event: ThreadEvent): void {
  if (event.type === CodexEventKind.TurnFailed || event.type === CodexEventKind.Error)
    throw new OperationalError(
      ErrorCode.CodexExecution,
      event.type === CodexEventKind.Error ? event.message : event.error.message,
    );
}

export function codexAnswer(spec: AgentSpec, state: CodexTurnState): AgentAnswer {
  if (!state.complete || !state.session_id)
    throw new OperationalError(ErrorCode.CodexIncomplete, CodexMessage.Incomplete);
  let json: unknown = null;
  if (spec.output_schema) {
    try {
      json = JSON.parse(state.text);
    } catch {
      throw new OperationalError(ErrorCode.CodexOutput, CodexMessage.InvalidOutput);
    }
  }
  return { text: state.text, json, session_id: state.session_id, usage: state.usage };
}
