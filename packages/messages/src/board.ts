import { RunFormat, TitanRelease } from "@titan/constants";

export const BoardMessage = {
  EventLog: "Run event log does not share its canonical durable journal",
  Paths: "Run paths do not match its durable record",
  Configuration: "Frozen configuration hash does not match",
  Plan: "Frozen plan hash does not match",
  Nodes: "Durable nodes do not match the frozen plan",
  Workspace: "Workspace path escapes its run",
  Sequence: "Invalid durable board sequence",
  Record: "Durable run record does not match its schema, paths or frozen plan",
  Limit: "Board record exceeds the configured limit",
  Missing: "Run not found",
  EventSize: "One event exceeds the inspection page byte limit",
  EventCursor: "Event cursor is beyond the latest committed event",
} as const;

export function unsupportedRunFormat(version: number): string {
  return `Run format ${version} is unsupported. This runtime supports formats ${Object.values(RunFormat).join(", ")}. Use the installed release that created this run and follow Run format recovery in docs/preview.md. Keep the saved journal intact.`;
}

export function unsupportedRunRuntime(version: string, current: string = TitanRelease): string {
  return `This run requires Titan ${version}. The current release is ${current}. Use the installed release that created this run and follow Run format recovery in docs/preview.md. Keep the saved journal intact.`;
}

export function unsupportedRunBuild(version: string, build: string): string {
  return `This run requires Titan ${version} with runtime bundle ${build}. Use the retained release that created this run. Keep the saved journal intact.`;
}
