export const NativeToolMessage = {
  Denied: "Native tool authority is absent, closed or no longer current.",
  Invalid: "Native tool scope is invalid.",
  Unavailable: "Native tool operation is unavailable.",
  Ready: "Check the active native tool scope and its available tools.",
  Audit: "Native tool audit could not be committed. Execution remains blocked.",
  Event: "Native tool event metadata is invalid. Execution remains blocked.",
  ReadFile:
    "Read a project file as base64 and durably record its observed version before returning it.",
  WriteFile:
    "Write a declared project file as UTF-8 after reading its version. Use null for a new file. This keeps the live inode and refuses changed or unlisted files.",
  ListFiles:
    "List regular project files recursively and durably record the observed file names before returning them.",
  ReadChanged: "A managed file dependency changed. Retained evidence requires reconciliation.",
  WritePolicy:
    "Project writes must stay within the declared file scope. Use titan_file_read to obtain a version and titan_file_write with that expected_version to create or replace a file when a native editor is refused. Use null only for a missing file. A changed version requires a fresh read and reconciliation. Shell commands cannot create, rename or remove project files.",
  ReadCapacity: "The execution reached its managed file observation limit.",
} as const;

export const nativeWriteRole = (role: string): string =>
  `${role}\n\n${NativeToolMessage.WritePolicy}`;
