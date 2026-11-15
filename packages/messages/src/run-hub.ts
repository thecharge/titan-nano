export const RunHubMessage = {
  JournalConflict: "The run journal identity belongs to another knowledge entry",
  JournalCapacity: "The run journal exceeds its retained lesson reference limit",
  ToolsMissing: (missing: readonly string[]): string =>
    `The run did not start because the hub tools cannot be offered: ${missing.join(", ")}`,
  Passed: (step: string, persona: string, attempt: number): string =>
    `Step ${step} passed with persona ${persona} on attempt ${attempt}`,
  Refuted: (step: string, persona: string, evidence: readonly string[]): string =>
    `Step ${step} was refuted for persona ${persona}: ${evidence.join("; ")}`,
  JournalTitle: (run: string, state: string): string => `Journal of run ${run} (${state})`,
  JournalUnwritable: (folder: string): string =>
    `The run journal could not be saved because the project hub folder cannot be written: ${folder}`,
} as const;
