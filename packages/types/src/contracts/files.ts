import type { Run, RunEvent } from "../board.ts";
import type { WorkspaceLimitsInput } from "../config.ts";
import type { FileMap } from "../workspace.ts";

export interface SecretScanner {
  accept(bytes: Uint8Array): void;
}

export type SecretScannerFactory = () => SecretScanner;

export type ByteWriter = (buffer: Uint8Array, offset: number, length: number) => Promise<number>;

export type WorkspaceWriter = (
  directory: string,
  files: FileMap,
  limits?: WorkspaceLimitsInput,
  scanner?: SecretScannerFactory,
) => Promise<void>;

export type RunProjectionWriter = (run: Run, kind?: string, event?: RunEvent) => Promise<void>;
