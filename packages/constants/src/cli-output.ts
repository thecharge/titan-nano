export const CliOutput = {
  Version: 1,
  OperationCharacters: 256,
} as const;

export enum CliOutputOperation {
  Help = "help",
  Version = "version",
  Unknown = "unknown",
}

export enum CliRecoveryAction {
  Resume = "resume",
  Observe = "status",
  RetrySubmission = "retry-submission",
}

export enum CliEventFormat {
  JsonLines = "jsonl",
}
