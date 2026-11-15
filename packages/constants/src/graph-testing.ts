export enum LongGraphMode {
  Complete = "complete",
  RefuteLeft = "refute-left",
  RefuteRight = "refute-right",
}
export const LongGraphFixture = {
  Waves: 8,
  Nodes: 40,
  CompletedStarts: 80,
  RefutedStarts: 36,
  CaseTimeout: 15000,
  ControlMilliseconds: 1000,
  CancellationMilliseconds: 1,
  ExecutionMilliseconds: 30000,
  Width: 2,
  RefutationWave: 3,
  Parts: ["seed", "left", "right", "join", "tail"],
} as const;
