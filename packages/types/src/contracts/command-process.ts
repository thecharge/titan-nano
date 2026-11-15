import type { ProcessSignal } from "@titan/constants";

export interface CapturedCommandProcess {
  readonly pid: number;
  readonly stdout: ReadableStream<Uint8Array>;
  readonly stderr: ReadableStream<Uint8Array>;
  readonly exited: Promise<number>;
  readonly signalCode: string | null;
  kill(signal: ProcessSignal): void;
}

export interface CommandProcessPort {
  spawn(command: readonly string[], cwd: string): CapturedCommandProcess;
  stop(pid: number): void;
}
