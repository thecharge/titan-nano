import { relative, resolve } from "node:path";
import { atomicWrite } from "@titan/board";
import { BoardLimit, ErrorCode, FileEncoding, ScriptExecution, TextSymbol } from "@titan/constants";
import { hash } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import { jsonBytes } from "@titan/streams";
import {
  type CommandCapture,
  type Run,
  type SavedCommandCapture,
  SavedCommandCaptureSchema,
} from "@titan/types";
import { readRetainedFile } from "@titan/workspace";

export async function saveScriptCapture(
  run: Run,
  directory: string,
  execution_id: string,
  capture: CommandCapture,
  elapsed_ms: number,
): Promise<SavedCommandCapture> {
  const saved = {
    exit_code: capture.exit_code,
    stdout: TextSymbol.Empty,
    stderr: TextSymbol.Empty,
    stdout_base64: capture.stdout.toString(FileEncoding.Base64),
    stderr_base64: capture.stderr.toString(FileEncoding.Base64),
    elapsed_ms,
  };
  const bytes = await jsonBytes(saved, BoardLimit.RecordBytes);
  const path = resolve(directory, execution_id + ScriptExecution.CaptureSuffix);
  await atomicWrite(path, bytes);
  return {
    exit_code: saved.exit_code,
    stdout: TextSymbol.Empty,
    stderr: TextSymbol.Empty,
    elapsed_ms,
    capture: { path: relative(run.root, path), hash: hash(bytes) },
  };
}

export async function loadScriptCapture(run: Run, input: unknown): Promise<CommandCapture> {
  let saved = SavedCommandCaptureSchema.parse(input);
  if (saved.capture) {
    const bytes = await readRetainedFile(
      run.root,
      saved.capture.path,
      saved.capture.hash,
      BoardLimit.RecordBytes,
    );
    const retained = SavedCommandCaptureSchema.parse(JSON.parse(bytes.toString(FileEncoding.Utf8)));
    if (retained.capture || retained.exit_code !== saved.exit_code)
      throw new OperationalError(ErrorCode.CheckpointChanged, RunnerMessage.ScriptCaptureChanged);
    saved = retained;
  }
  return {
    exit_code: saved.exit_code,
    stdout:
      saved.stdout_base64 === undefined
        ? Buffer.from(saved.stdout)
        : Buffer.from(saved.stdout_base64, FileEncoding.Base64),
    stderr:
      saved.stderr_base64 === undefined
        ? Buffer.from(saved.stderr)
        : Buffer.from(saved.stderr_base64, FileEncoding.Base64),
  };
}
