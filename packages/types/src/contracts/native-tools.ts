import type { NativeFileListResult, NativeFileResult } from "../native-files.ts";
import type { NativeToolAuditRecord } from "../native-tool-audit.ts";
import type { NativeToolConnection } from "../native-tool-connection.ts";
import type { NativeToolBinding } from "../native-tool-launch.ts";
import type { NativeToolScope } from "../native-tools.ts";
import type { SecretScannerFactory } from "./files.ts";

export interface NativeToolRegistration {
  scope: NativeToolScope;
  current(): boolean;
  closing: boolean;
  failed: boolean;
  stopping?: Promise<void>;
}

export interface NativeToolLease {
  token: string;
  tools: readonly string[];
  guard(): void;
  close(): Promise<void>;
}

export type NativeToolCurrent = () => boolean;
export type NativeFileReader = (scope: NativeToolScope, path: string) => Promise<NativeFileResult>;
export type NativeFileLister = (
  scope: NativeToolScope,
  directory: string,
) => Promise<NativeFileListResult>;
export type NativeToolAuditWriter = (
  scope: NativeToolScope,
  record: NativeToolAuditRecord,
) => Promise<void>;
export type NativeToolEndpoint = () => string;

export type NativeToolEnvironmentFactory = (
  connection: NativeToolConnection,
) => Record<string, string>;

export interface NativeToolExecution {
  binding: NativeToolBinding;
  scanner: SecretScannerFactory;
  guard(value: unknown): Promise<void>;
  close(): Promise<void>;
}

export interface NativeToolExecutionOwner {
  open(
    scope: NativeToolScope,
    current: NativeToolCurrent,
    runDirectory: string,
  ): NativeToolExecution;
}

export type NativeToolExecutionProvider = () => NativeToolExecution | undefined;

export type NativeToolPreflight = (
  connection: NativeToolConnection,
  signal: AbortSignal,
) => Promise<void>;
