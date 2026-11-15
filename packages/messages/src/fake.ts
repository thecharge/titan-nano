export const FakeMessage = {
  InvalidScript: "Fake answer script is invalid or exceeds its limits",
  Duplicate: "Fake answer script repeats a persona, task, attempt and execution",
  InvalidPrompt: "Fake invocation requires a bounded task and durable execution coordinates",
  Completed: "Stub worker completed",
  Response: "Stub response; no real agent was called",
} as const;

export const unscriptedFakeTask = (task: string): string =>
  `fake backend has no script for task: ${task}`;
