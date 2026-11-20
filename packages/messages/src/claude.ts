export const ClaudeMessage = {
  AuthenticationFailed:
    "Claude Agent SDK authentication failed. Check the configured provider credentials before resuming.",
  QuotaExhausted: "Claude requires credits before this execution can continue",
  InvalidRetry: "Claude returned invalid retry fields",
  UnknownRetry: "Claude reported an unclassified retry; inspect its native session before resuming",
  RateLimited: "Claude reported a retryable rate limit",
  ServiceUnavailable: "Claude reported a temporary service failure",
  SessionChanged: "Claude replaced the native session; the original session must be restored",
  UnsupportedTools:
    "Requested tools cannot be enforced in this Claude invocation; shell access and read-only writes are unsupported",
  UnexpectedHook: "Unexpected hook event",
  WorkspacePolicy: "Titan workspace policy",
  ToolDenied: "Tool is outside the workspace policy",
  PathDenied: "Path is outside this invocation workspace",
  MissingSession: "Claude returned no session ID",
  InvalidUsage: "Claude returned invalid usage fields",
  Incomplete: "Claude ended before a result",
} as const;

export const claudeErrors = (errors: string[]): string => errors.join("; ");
