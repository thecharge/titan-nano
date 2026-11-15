import { resolve } from "node:path";
import { ErrorCode, RunFile, WorkspaceModeSetting } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { liveCandidateConflict, rollbackConflict } from "@titan/messages";
import type { FileMap, NodeState, Run, Step } from "@titan/types";
import { fileIdentity, putBack, readTree } from "@titan/workspace";
import { scopeCovers, writePaths } from "./file-scope.ts";
import { isWorkerKey } from "./native-execution.ts";
import { verifyNativeReads } from "./native-files.ts";
import { withWriteInputs } from "./write-inputs.ts";

export function liveRun(run: Run): boolean {
  const mode = run.config.value.workspace?.mode ?? WorkspaceModeSetting.Live;
  return mode === WorkspaceModeSetting.Live;
}

export function scoped(run: Run, step: Step, files: FileMap): FileMap {
  if (!step.files || !liveRun(run)) return files;
  const listed = writePaths(run, step);
  return Object.fromEntries(
    Object.entries(files).filter(([path]) => listed.some((entry) => scopeCovers(entry, path))),
  );
}

export function workPath(run: Run, state: NodeState, folder: string): string {
  return state.work ?? (liveRun(run) ? run.project : resolve(folder, RunFile.Work));
}

export async function verifyLiveCandidate(run: Run, candidate: string, step: Step): Promise<void> {
  if (!liveRun(run)) return;
  for (const [key, phase] of Object.entries(run.nodes[step.id]?.phases ?? {}))
    await verifyNativeReads(run, step, phase.file_reads ?? [], isWorkerKey(key));
  const limits = run.config.value.limits;
  const retained = await readTree(candidate, limits);
  const current = await readTree(run.project, limits, undefined, run.runtime_paths);
  for (const path of new Set([...Object.keys(retained), ...Object.keys(current)]))
    if (fileIdentity(retained[path]) !== fileIdentity(current[path]))
      throw new OperationalError(ErrorCode.FileConflict, liveCandidateConflict(path));
}

export async function rollBack(
  run: Run,
  step: Step,
  restorePoint: string,
  candidate: string,
  preserveConcurrent = false,
): Promise<void> {
  const limits = run.config.value.limits;
  const before = scoped(
    run,
    step,
    await withWriteInputs(run, step, await readTree(restorePoint, limits)),
  );
  const after = scoped(run, step, await readTree(candidate, limits));
  const current = scoped(
    run,
    step,
    await readTree(run.project, limits, undefined, run.runtime_paths),
  );
  const restored: FileMap = {};
  const removals: string[] = [];
  for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (fileIdentity(before[path]) === fileIdentity(after[path])) continue;
    if (fileIdentity(current[path]) !== fileIdentity(after[path]) && preserveConcurrent) continue;
    if (fileIdentity(current[path]) !== fileIdentity(after[path]))
      throw new OperationalError(ErrorCode.FileConflict, rollbackConflict(path));
    const entry = before[path];
    if (entry) restored[path] = entry;
    else removals.push(path);
  }
  await putBack(run.project, restored, removals);
}
