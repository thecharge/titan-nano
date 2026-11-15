import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CommandCaptureFixture,
  CommandCaptureLimit,
  CommandCaptureTest,
  ErrorCode,
  IoLimit,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { CommandCaptureMessage } from "@titan/messages";
import { captureCommand, ownedCommandProcesses } from "@titan/process";
import { readFileBytes } from "@titan/streams";
import { processExited, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CaptureCommandSchema,
  type CapturedCommandProcess,
  type CommandCaptureOptions,
  CommandCaptureOptionsSchema,
  type CommandProcessPort,
} from "@titan/types";
import { exists } from "@titan/workspace";

function failedChildStop(child: CapturedCommandProcess): CapturedCommandProcess {
  return {
    pid: child.pid,
    stdout: child.stdout,
    stderr: child.stderr,
    exited: child.exited,
    get signalCode() {
      return child.signalCode;
    },
    kill(signal) {
      child.kill(signal);
      throw new Error(CommandCaptureMessage.Timeout);
    },
  };
}

function commandProcesses(mode: CommandCaptureFixture): CommandProcessPort {
  if (
    ![CommandCaptureFixture.GroupStopFailure, CommandCaptureFixture.ChildStopFailure].includes(mode)
  )
    return ownedCommandProcesses;
  return {
    spawn(command, cwd) {
      const child = ownedCommandProcesses.spawn(command, cwd);
      return mode === CommandCaptureFixture.ChildStopFailure ? failedChildStop(child) : child;
    },
    stop() {
      throw new OperationalError(ErrorCode.ExecutionInterrupted, CommandCaptureMessage.Signal);
    },
  };
}

export async function commandCapture(mode: CommandCaptureFixture) {
  const inspect = async (root: string) => {
    const controller = new AbortController();
    const pidFile = resolve(root, "child.pid");
    const descendantFile = resolve(root, "descendant.pid");
    if (mode === CommandCaptureFixture.PreCancelled) controller.abort();
    const timer =
      mode === CommandCaptureFixture.Cancel
        ? setTimeout(() => controller.abort(), CommandCaptureTest.DeadlineMilliseconds)
        : undefined;
    const command = [
      process.execPath,
      fileURLToPath(import.meta.resolve("../fixtures/command-capture.ts")),
      pidFile,
      mode,
      descendantFile,
      ...(mode === CommandCaptureFixture.EmptyArgument ? [""] : []),
    ];
    if (mode === CommandCaptureFixture.EmptyCommand) command.length = 0;
    if (mode === CommandCaptureFixture.ZeroByte) command.push("\0");
    if (mode === CommandCaptureFixture.ExcessArguments)
      command.push(...Array.from({ length: CommandCaptureLimit.Arguments }, () => "argument"));
    const rejectedBeforeStart = [
      CommandCaptureFixture.PreCancelled,
      CommandCaptureFixture.EmptyCommand,
      CommandCaptureFixture.ZeroByte,
      CommandCaptureFixture.ExcessArguments,
      CommandCaptureFixture.InvalidOptions,
    ].includes(mode);
    const options: CommandCaptureOptions = {
      maximum_bytes: CommandCaptureTest.Bytes,
      timeout_ms: CommandCaptureTest.DeadlineMilliseconds,
    };
    if (mode === CommandCaptureFixture.InvalidOptions) options.maximum_bytes = 0;
    let starts = 0;
    const owner = commandProcesses(mode);
    const processes: CommandProcessPort = {
      spawn(command, cwd) {
        starts++;
        return owner.spawn(command, cwd);
      },
      stop(pid) {
        owner.stop(pid);
      },
    };
    try {
      const result = await captureCommand(command, root, options, controller.signal, processes);
      assert.equal(
        result.exit_code,
        mode === CommandCaptureFixture.Nonzero ? CommandCaptureTest.ExitCode : 0,
      );
      assert.equal(
        result.stdout.equals(Buffer.alloc(CommandCaptureTest.Bytes, CommandCaptureTest.StdoutByte)),
        true,
      );
      assert.equal(
        result.stderr.equals(Buffer.alloc(CommandCaptureTest.Bytes, CommandCaptureTest.StderrByte)),
        true,
      );
      return true;
    } finally {
      clearTimeout(timer);
      assert.equal(starts, rejectedBeforeStart ? 0 : 1);
      if (rejectedBeforeStart) assert.equal(await exists(pidFile), false);
      else {
        const pid = Number((await readFileBytes(pidFile, IoLimit.HashBytes)).toString());
        assert.equal(await processExited(pid), true);
      }
      if (mode === CommandCaptureFixture.Descendant) {
        const pid = Number((await readFileBytes(descendantFile, IoLimit.HashBytes)).toString());
        assert.equal(await waitUntil(() => processExited(pid)), true);
      }
    }
  };
  return withTemporaryDirectory(inspect);
}

export function commandCaptureArguments(command: unknown) {
  return CaptureCommandSchema.parse(command);
}

export function commandCaptureOptions(options: unknown) {
  return CommandCaptureOptionsSchema.parse(options);
}
