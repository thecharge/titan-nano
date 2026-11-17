export const CodexMessage = {
  SessionChanged: "Codex replaced the native session; the original session must be restored",
  InvalidUsage: "Codex returned invalid usage fields",
  Incomplete: "Codex ended before a complete turn and session ID",
  InvalidOutput: "Codex returned invalid structured JSON",
} as const;

export const codexPrompt = (role: string, prompt: string): string => `${role}\n\n${prompt}`;

export const codexTruncatedOutput = (bytes: number, digest: string): string =>
  `\n[Titan retained an excerpt. Original UTF-8 bytes ${bytes}, SHA-256 ${digest}]`;
