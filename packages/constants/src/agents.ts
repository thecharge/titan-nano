import { TimerLimit } from "./concurrency.ts";
import { AgentTool } from "./config.ts";

export enum UsageMetric {
  InputTokens = "input_tokens",
  OutputTokens = "output_tokens",
  Cost = "cost_usd",
}

export const UsageReport = { Version: 1 } as const;

export enum AgentEventKind {
  Session = "session",
  Message = "message",
  ToolIntent = "tool_intent",
  ToolResult = "tool_result",
  Usage = "usage",
}

export enum CodexEventKind {
  ThreadStarted = "thread.started",
  ItemCompleted = "item.completed",
  TurnCompleted = "turn.completed",
  TurnFailed = "turn.failed",
  Error = "error",
  AgentMessage = "agent_message",
}

export enum CodexPolicy {
  Disabled = "disabled",
  WorkspaceWrite = "workspace-write",
  ReadOnly = "read-only",
  NeverApprove = "never",
}

export const CodexDisabledFeatures = {
  apps: false,
  plugins: false,
  remote_plugin: false,
  hooks: false,
} as const;

export const CodexNativeToolReadiness = "connection";

export enum SdkArgumentField {
  Options = "options",
  SessionId = "session_id",
  Hooks = "hooks",
  CanUseTool = "canUseTool",
}

export enum ClaudeEventKind {
  Assistant = "assistant",
  ApiRetry = "api_retry",
  System = "system",
  Result = "result",
  Success = "success",
  PreToolUse = "PreToolUse",
  PostToolUse = "PostToolUse",
  PostToolUseFailure = "PostToolUseFailure",
  User = "user",
}

export const ClaudeNativeTool = { Prefix: "mcp__titan__", PollMilliseconds: 25 } as const;
export enum ClaudeMcpStatus {
  Connected = "connected",
  Pending = "pending",
}

export enum ClaudePermission {
  Allow = "allow",
  Deny = "deny",
  Block = "block",
  Default = "default",
}

export const ClaudeOutputTool = "StructuredOutput";

export enum StructuredOutputKind {
  JsonSchema = "json_schema",
}

export enum AgentField {
  Verdict = "verdict",
}

export enum AgentRuntime {
  Bun = "bun",
  Node = "node",
}

export const ClaudeToolPolicy = {
  ReadOnly: [AgentTool.Read, AgentTool.Glob, AgentTool.Grep],
  Writable: [
    AgentTool.Read,
    AgentTool.Glob,
    AgentTool.Grep,
    AgentTool.Write,
    AgentTool.Edit,
    AgentTool.Bash,
  ],
} as const;

export const ClaudeShellGuard = {
  Programs: [
    "git",
    "curl",
    "wget",
    "ssh",
    "scp",
    "sudo",
    "su",
    "nc",
    "eval",
    "bash",
    "sh",
    "zsh",
    "xargs",
  ],
  Quotes: /[\\"']/g,
  Statements: /[;&|\n]+/,
  Words: /[\s<>(){}]+/,
  Expansion: /`|\$\(|\$\{|~|\0/,
  Change: "cd",
  Empty: "",
  Assignment: /(?:^|[\s;&|])([A-Za-z_]\w*)=/g,
  Reference: /\$(\w+)/g,
} as const;

export const ClaudeGlobPattern = {
  Unsafe: /[\\\0~()]|\.\./,
  Component: /^(?:[^{}]|\{[^{}]*\})+$/,
} as const;

export enum ClaudeRetryCause {
  BillingError = "billing_error",
  RateLimit = "rate_limit",
  Overloaded = "overloaded",
  ServerError = "server_error",
}

export enum ClaudeCreditCode {
  Required = "credits_required",
}

export const ClaudeRetryLimit = {
  DelayMilliseconds: TimerLimit.Milliseconds,
  CauseCharacters: 128,
  MinimumStatus: 100,
  MaximumStatus: 599,
  RateLimitStatus: 429,
  ServiceStatusMinimum: 500,
} as const;

export const FakeScriptLimit = { Version: 1, Entries: 1_024, FirstExecution: 1 } as const;

export enum FakeScriptField {
  Answers = "answers",
}

export const NativeWritePolicy = {
  Profile: "titan-scoped",
  MaximumFiles: 128,
  MaximumGrantBytes: 65536,
  EntryOverhead: 256,
  Metadata: [".git", ".agents", ".codex", ".aws"],
  Read: "read",
  Write: "write",
  Root: ":root",
  Workspace: ":workspace_roots",
  Filesystem: "permissions.titan-scoped.filesystem=",
  Default: 'default_permissions="titan-scoped"',
  Network: "permissions.titan-scoped.network.enabled=false",
  Separator: ",",
  Assignment: "=",
  Open: "{",
  Close: "}",
} as const;

export const ClaudeSandbox = {
  Devices: "/dev/",
  Prefix: "titan-shell-policy-",
  Settings: "policy.json",
  Cli: "./cli.js",
  SettingsArgument: "--settings",
  CommandArgument: "-c",
  Quote: "'",
  EscapedQuote: "'\\''",
  MaximumCommands: 1024,
  MaximumCommandBytes: 65536,
  MaximumRegistryBytes: 4194304,
  Space: " ",
} as const;
