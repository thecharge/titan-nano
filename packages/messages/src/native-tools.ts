export const NativeToolMessage = {
  Denied: "Native tool authority is absent, closed or no longer current.",
  Invalid: "Native tool scope is invalid.",
  Unavailable: "Native tool operation is unavailable.",
  Ready: "Check the active native tool scope and its available tools.",
  Audit: "Native tool audit could not be committed. Execution remains blocked.",
  Event: "Native tool event metadata is invalid. Execution remains blocked.",
  ReadFile:
    "Read a project file as base64 and durably record its observed version before returning it.",
  ListFiles:
    "List regular project files recursively and durably record the observed file names before returning them.",
  ReadChanged: "A managed file dependency changed. Retained evidence requires reconciliation.",
  ReadCapacity: "The execution reached its managed file observation limit.",
} as const;
