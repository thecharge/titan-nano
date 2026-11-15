import { resolve } from "node:path";
import { ErrorCode, FileWriteScope, RunEventKind, RunFile, RuntimeLimit } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import type { FileMap, Run, RunCommit, Step } from "@titan/types";
import { readTree, treeHash, writeTree } from "@titan/workspace";
import { scopeCovers } from "./file-scope.ts";

export async function captureWriteInput(run: Run, step: Step, commit: RunCommit): Promise<void> {
  const state = run.nodes[step.id];
  if (!state?.write_paths) return;
  const previous = state.write_inputs;
  const covered = [...(step.files ?? []), ...(previous?.flatMap((entry) => entry.paths) ?? [])];
  const paths = state.write_paths.filter(
    (path) => !covered.some((entry) => scopeCovers(entry, path)),
  );
  if (!paths.length) return;
  if ((previous?.length ?? 0) >= RuntimeLimit.PendingOperations)
    throw new OperationalError(ErrorCode.Capacity, RunnerMessage.FileWriteClaims);
  const limits = run.config.value.limits;
  const current = await readTree(run.project, limits, undefined, run.runtime_paths, paths);
  const files = Object.fromEntries(
    Object.entries(current).filter(
      ([path]) =>
        paths.some((entry) => scopeCovers(entry, path)) &&
        !covered.some((entry) => scopeCovers(entry, path)),
    ),
  );
  const input = resolve(
    run.root,
    RunFile.Steps,
    step.id,
    `${RunFile.AttemptPrefix}${state.attempt}`,
    `${FileWriteScope.InputPrefix}${(previous?.length ?? 0) + 1}`,
  );
  await writeTree(input, files, limits);
  const input_hash = await treeHash(await readTree(input, limits));
  state.write_inputs = [
    ...(previous ?? []),
    { paths, input, input_hash, generation: state.reconciliations?.length ?? 0 },
  ];
  try {
    await commit(run, RunEventKind.FileWriteInputCaptured, {
      step_id: step.id,
      attempt: state.attempt,
      input,
      input_hash,
      paths,
    });
  } catch (error) {
    if (previous) state.write_inputs = previous;
    else delete state.write_inputs;
    throw error;
  }
}

export async function withWriteInputs(run: Run, step: Step, input: FileMap): Promise<FileMap> {
  const state = run.nodes[step.id];
  const files = { ...input };
  for (const entry of state?.write_inputs ?? []) {
    const baseline = await readTree(entry.input, run.config.value.limits);
    if ((await treeHash(baseline)) !== entry.input_hash)
      throw new OperationalError(ErrorCode.CheckpointChanged, RunnerMessage.InputCheckpoint);
    if (entry.generation !== (state?.reconciliations?.length ?? 0)) continue;
    Object.assign(files, baseline);
  }
  return files;
}
