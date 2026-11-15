export enum NativeVendorEvent {
  CodexTool = "mcp_tool_call",
  CodexStarted = "item.started",
  CodexUpdated = "item.updated",
  CodexCompleted = "item.completed",
  ClaudeAssistant = "assistant",
  ClaudeUser = "user",
  ClaudePartial = "stream_event",
  ClaudeUse = "tool_use",
  ClaudeResult = "tool_result",
}

export enum NativeEventActivity {
  Intent = "intent",
  Progress = "progress",
  Result = "result",
  Partial = "partial",
}

export enum NativeCodexStatus {
  Running = "in_progress",
  Completed = "completed",
  Failed = "failed",
}

export const NativeEventLimit = { IdentityCharacters: 128, NameCharacters: 256 } as const;
export const NativeEventProjection = { Version: 1 } as const;
export const NativeEventField = { ToolResult: "tool_use_result" } as const;

export enum NativeEventFixture {
  Codex = "codex",
  CodexStarted = "codex_started",
  CodexUpdated = "codex_updated",
  UnknownTool = "unknown_tool",
  ClaudeUse = "claude_use",
  ClaudeResult = "claude_result",
  ClaudeStructured = "claude_structured",
  ClaudePartial = "claude_partial",
  ClaudeText = "claude_text",
  ClaudeExternal = "claude_external",
  ClaudeMissingIdentity = "claude_missing_identity",
  ClaudeBadBlock = "claude_bad_block",
  Unmarked = "unmarked",
  Ordinary = "ordinary",
  External = "external",
  MissingIdentity = "missing_identity",
  UnsupportedStatus = "unsupported_status",
  ExcessBlocks = "excess_blocks",
}
