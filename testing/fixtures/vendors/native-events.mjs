import {
  Backend,
  ClaudeNativeTool,
  KnowledgeTool,
  NativeCodexStatus,
  NativeEventField,
  NativeTool,
  NativeVendorEvent,
} from "@titan/constants";

export function codexNativeEvents(tools, session, emit) {
  return nativeEvents(Backend.Codex, tools, session, emit);
}

export function claudeNativeEvents(tools, session, emit) {
  return nativeEvents(Backend.Claude, tools, session, emit);
}

async function nativeEvents(backend, tools, session, emit) {
  if (!tools?.result) return;
  const id = "native-read";
  const result = tools.result;
  const input = { question: "Private native query" };
  if (backend === Backend.Codex) {
    const item = {
      id,
      type: NativeVendorEvent.CodexTool,
      server: NativeTool.Name,
      tool: KnowledgeTool.Get,
      arguments: input,
      result,
      error: null,
      status: NativeCodexStatus.Running,
    };
    await emit({ type: NativeVendorEvent.CodexStarted, item });
    await emit({ type: NativeVendorEvent.CodexUpdated, item });
    item.status = NativeCodexStatus.Completed;
    await emit({ type: NativeVendorEvent.CodexCompleted, item });
    return;
  }
  const use = {
    type: NativeVendorEvent.ClaudeUse,
    id,
    name: ClaudeNativeTool.Prefix + KnowledgeTool.Get,
    input,
  };
  const assistant = {
    id: "native-assistant",
    role: "assistant",
    content: [use],
    model: "stub-model",
    stop_reason: "tool_use",
    stop_sequence: null,
    type: "message",
    usage: { input_tokens: 0, output_tokens: 0 },
  };
  await emit({
    type: NativeVendorEvent.ClaudeAssistant,
    message: assistant,
    session_id: session,
    parent_tool_use_id: null,
    uuid: "native-use",
  });
  const block = { type: NativeVendorEvent.ClaudeResult, tool_use_id: id, content: result.content };
  const user = { role: "user", content: [block] };
  await emit({
    type: NativeVendorEvent.ClaudeUser,
    message: user,
    session_id: session,
    parent_tool_use_id: null,
    uuid: "native-result",
    [NativeEventField.ToolResult]: result,
  });
}
