import {
  ErrorCode,
  ErrorField,
  LeanCheck,
  MissingProcessCode,
  ProcessIo,
  ProcessSignal,
  SignalEvent,
} from "@titan/constants";
import { all } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { CommandCaptureMessage } from "@titan/messages";
import { readBytes } from "@titan/streams";
import {
  CaptureCommandSchema,
  type CommandCapture,
  type CommandCaptureOptions,
  CommandCaptureOptionsSchema,
  type CommandProcessPort,
  type LeanRun,
} from "@titan/types";

export const ownedCommandProcesses = Object.freeze<CommandProcessPort>({
  spawn(command, cwd) {
    return Bun.spawn([...command], {
      cwd,
      detached: true,
      stdin: ProcessIo.Ignore,
      stdout: ProcessIo.Pipe,
      stderr: ProcessIo.Pipe,
    });
  },
  stop(pid) {
    process.kill(-pid, ProcessSignal.Kill);
  },
});

export async function captureCommand(
  command: readonly string[],
  cwd: string,
  options: CommandCaptureOptions = {},
  signal?: AbortSignal,
  processes: CommandProcessPort = ownedCommandProcesses,
): Promise<CommandCapture> {
  const args = CaptureCommandSchema.parse(command);
  const limits = CommandCaptureOptionsSchema.parse(options);
  signal?.throwIfAborted();
  const child = processes.spawn(args, cwd);
  let result: CommandCapture;
  let expired = false;
  let failed = false;
  let failure: unknown;
  const cancellation = new AbortController();
  const recordFailure = (error: unknown): void => {
    if (failed) return;
    failed = true;
    failure = error;
  };
  const stop = (): void => {
    cancellation.abort();
    try {
      processes.stop(child.pid);
    } catch (error) {
      if (error instanceof Error && Reflect.get(error, ErrorField.Code) === MissingProcessCode)
        return;
      recordFailure(error);
      try {
        child.kill(ProcessSignal.Kill);
      } catch (error) {
        recordFailure(error);
      }
    }
  };
  const timer = setTimeout(() => {
    expired = true;
    stop();
  }, limits.timeout_ms);
  const collect = async (source: ReadableStream<Uint8Array>): Promise<Buffer> => {
    try {
      const owned = source.pipeThrough(new TransformStream<Uint8Array, Uint8Array>(), {
        signal: cancellation.signal,
      });
      return await readBytes(owned, limits.maximum_bytes);
    } catch (error) {
      recordFailure(error);
      stop();
      return Buffer.alloc(0);
    }
  };
  signal?.addEventListener(SignalEvent.Abort, stop, { once: true });
  if (signal?.aborted) stop();
  try {
    const [stdout, stderr] = await all([() => collect(child.stdout), () => collect(child.stderr)]);
    const exit_code = await child.exited;
    signal?.throwIfAborted();
    if (expired)
      throw new OperationalError(ErrorCode.CommandTimeout, CommandCaptureMessage.Timeout);
    if (failed) throw failure;
    if (child.signalCode !== null)
      throw new OperationalError(ErrorCode.ExecutionInterrupted, CommandCaptureMessage.Signal);
    result = { exit_code, stdout, stderr };
  } catch (error) {
    signal?.throwIfAborted();
    if (expired)
      throw new OperationalError(ErrorCode.CommandTimeout, CommandCaptureMessage.Timeout);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener(SignalEvent.Abort, stop);
    try {
      stop();
    } finally {
      await child.exited;
    }
  }
  if (failed) throw failure;
  return result;
}

export function leanRunner(processes: CommandProcessPort = ownedCommandProcesses): LeanRun {
  return (command, cwd, timeout_ms, signal) =>
    captureCommand([...LeanCheck.Sandbox, ...command], cwd, { timeout_ms }, signal, processes);
}
