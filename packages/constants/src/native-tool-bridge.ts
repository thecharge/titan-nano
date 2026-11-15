import { AgentHost } from "./agent-host.ts";
import { LocalServer } from "./transport.ts";

export const NativeToolEnvironment = {
  GcMarkers: AgentHost.GcMarkersEnvironment,
  WorkerThreads: AgentHost.WorkerThreadsEnvironment,
  Url: "TITAN_NATIVE_TOOLS_URL",
  Token: "TITAN_NATIVE_TOOLS_TOKEN",
  Timeout: "TITAN_NATIVE_TOOLS_TIMEOUT_MS",
  RunDirectory: "TITAN_RUN_DIRECTORY",
  RunId: "TITAN_RUN_ID",
  Role: "TITAN_AGENT_ROLE",
  StepId: "TITAN_STEP_ID",
  PartId: "TITAN_PART_ID",
  CandidateId: "TITAN_CANDIDATE_ID",
  Attempt: "TITAN_ATTEMPT",
  ExecutionId: "TITAN_EXECUTION_ID",
} as const;

export enum NativeToolBridgeFixture {
  Ready = "ready",
  Scope = "scope",
  ReadyTools = "ready_tools",
  ListedTools = "listed_tools",
  NoReady = "no_ready",
  Malformed = "malformed",
  Transport = "transport",
}

export const NativeToolStdioEvent = { End: "end", Close: "close", Error: "error" } as const;

export const NativeToolRedirect = "error";

export enum NativeToolResponseFixture {
  Json = "json",
  Empty = "empty",
  Oversized = "oversized",
  Slow = "slow",
  Redirect = "redirect",
}

export enum NativeToolOutputFixture {
  Immediate = "immediate",
  Backpressure = "backpressure",
  Error = "error",
  Throw = "throw",
  Close = "close",
  Closed = "closed",
  Stalled = "stalled",
  Cancelled = "cancelled",
  Ended = "ended",
}

export const NativeToolBearerReference = `${LocalServer.Bearer}\${${NativeToolEnvironment.Token}}`;
