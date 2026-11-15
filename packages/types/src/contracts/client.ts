import type { ProcessIo, RunAction } from "@titan/constants";
import type { ArtifactInspection, ArtifactPage, ArtifactQueryInput } from "../artifacts.ts";
import type { EventPage, EventQueryInput } from "../board.ts";
import type { RunListQueryInput, RunPage } from "../catalog.ts";
import type { RunConfiguration } from "../config.ts";
import type { RunSnapshot } from "../transport.ts";
import type { RunUsage } from "../usage.ts";

export interface RunClient {
  configuration(id: string): Promise<RunConfiguration>;
  usage(id: string): Promise<RunUsage>;
  artifact(id: string, file: string, query?: ArtifactQueryInput): Promise<ArtifactPage>;
  artifacts(id: string): Promise<ArtifactInspection>;
  get(id: string): Promise<RunSnapshot>;
  submit(body: unknown): Promise<RunSnapshot>;
  control(id: string, action: RunAction, backend?: string): Promise<RunSnapshot>;
  list(query?: RunListQueryInput): Promise<RunPage>;
  events(id: string, query?: EventQueryInput): Promise<EventPage>;
}

export type RunClientAction<T = unknown> = (client: RunClient) => Promise<T>;

export type ClientConnector = () => Promise<void>;
export type ClientRuntimeRecovery = (version: string, build?: string) => Promise<boolean>;
export type ClientTransport = (path: string, method?: string, body?: unknown) => Promise<unknown>;

export type DaemonProcess = Bun.Subprocess<ProcessIo.Ignore, ProcessIo.Ignore, ProcessIo.Ignore>;

export interface DaemonStartupServices {
  probe(home: string, timeout: number, version?: string, build?: string | null): Promise<boolean>;
  stopIdle?(home: string): Promise<void>;
  launch(home: string, entry?: string, version?: string): DaemonProcess;
  now(): number;
  wait(milliseconds: number): Promise<void>;
}
