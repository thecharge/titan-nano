import {
  Backend,
  ClaudeNativeTool,
  ErrorCode,
  NativeEventActivity,
  NativeEventField,
  NativeEventProjection,
  NativeTool,
  NativeToolAudit,
  NativeVendorEvent,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { NativeToolMessage } from "@titan/messages";
import {
  type AgentEvent,
  NativeClaudeBlockSchema,
  NativeClaudeMessageSchema,
  NativeClaudeResultSchema,
  NativeClaudeUseSchema,
  NativeCodexEventSchema,
  NativeCodexMarkerSchema,
  NativeEventProjectionSchema,
  type NativeObservedTool,
  NativeToolNameSchema,
  NativeVendorMarkerSchema,
} from "@titan/types";

function observedName(value: string) {
  const parsed = NativeToolNameSchema.safeParse(value);
  return parsed.success ? parsed.data : NativeToolAudit.Unknown;
}

function codexProjection(event: AgentEvent): AgentEvent {
  const { item, type } = NativeCodexEventSchema.parse(event.data);
  if (item.server !== NativeTool.Name) return event;
  const activity =
    type === NativeVendorEvent.CodexStarted
      ? NativeEventActivity.Intent
      : type === NativeVendorEvent.CodexUpdated
        ? NativeEventActivity.Progress
        : NativeEventActivity.Result;
  const tool = { call_id: item.id, tool: observedName(item.tool), status: item.status };
  const data = NativeEventProjectionSchema.parse({
    schema_version: NativeEventProjection.Version,
    backend: Backend.Codex,
    activity,
    tools: [tool],
  });
  return { ...event, data };
}

function claudeUse(block: unknown): NativeObservedTool[] {
  if (NativeClaudeBlockSchema.parse(block).type !== NativeVendorEvent.ClaudeUse) return [];
  const use = NativeClaudeUseSchema.parse(block);
  if (!use.name.startsWith(ClaudeNativeTool.Prefix)) return [];
  return [
    {
      call_id: use.id,
      tool: observedName(use.name.slice(ClaudeNativeTool.Prefix.length)),
      status: null,
    },
  ];
}

function claudeResult(block: unknown): NativeObservedTool[] {
  if (NativeClaudeBlockSchema.parse(block).type !== NativeVendorEvent.ClaudeResult) return [];
  return [
    {
      call_id: NativeClaudeResultSchema.parse(block).tool_use_id,
      tool: NativeToolAudit.Unknown,
      status: null,
    },
  ];
}

function claudeProjection(event: AgentEvent, type: string): AgentEvent {
  if (type === NativeVendorEvent.ClaudePartial)
    return {
      ...event,
      data: NativeEventProjectionSchema.parse({
        schema_version: NativeEventProjection.Version,
        backend: Backend.Claude,
        activity: NativeEventActivity.Partial,
        tools: [],
      }),
    };
  const message = NativeClaudeMessageSchema.parse(event.data).message;
  const blocks = Array.isArray(message.content) ? message.content : [];
  const uses = type === NativeVendorEvent.ClaudeAssistant;
  const tools = blocks.flatMap(uses ? claudeUse : claudeResult);
  if (!uses && Object.hasOwn(event.data as object, NativeEventField.ToolResult) && !tools.length)
    tools.push({ call_id: null, tool: NativeToolAudit.Unknown, status: null });
  if (!tools.length) return event;
  return {
    ...event,
    data: NativeEventProjectionSchema.parse({
      schema_version: NativeEventProjection.Version,
      backend: Backend.Claude,
      activity: uses ? NativeEventActivity.Intent : NativeEventActivity.Result,
      tools,
    }),
  };
}

export function projectNativeEvent(event: AgentEvent, enabled: boolean): AgentEvent {
  if (!enabled) return event;
  try {
    if (NativeCodexMarkerSchema.safeParse(event.data).success) return codexProjection(event);
    const marker = NativeVendorMarkerSchema.safeParse(event.data);
    if (!marker.success) return event;
    if (
      [
        NativeVendorEvent.ClaudeAssistant,
        NativeVendorEvent.ClaudeUser,
        NativeVendorEvent.ClaudePartial,
      ].some((type) => type === marker.data.type)
    )
      return claudeProjection(event, marker.data.type);
    return event;
  } catch {
    throw new OperationalError(ErrorCode.NativeToolProtocol, NativeToolMessage.Event);
  }
}
