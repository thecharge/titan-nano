import { resolve } from "node:path";
import {
  ErrorCode,
  ExecutionPhase,
  FileEncoding,
  IoLimit,
  PathPart,
  RunFile,
  StepStatus,
} from "@titan/constants";
import { all } from "@titan/core";
import { TitanError } from "@titan/errors";
import { fileConflict, RunnerMessage, stepReference } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import type { FileMap, NodeState, Run, Step } from "@titan/types";
import { assertManifestBounds, exists, fileIdentity, readTree, treeHash } from "@titan/workspace";
import { liveRun } from "./live.ts";

export function runParents(run: Run, step: Step): Set<string> {
  const result = new Set<string>();
  const visit = (node: Step): void => {
    for (const key of node.needs ?? []) {
      if (result.has(key)) continue;
      result.add(key);
      const parent = run.plan.nodes.find((entry) => entry.id === key);
      if (parent) visit(parent);
    }
  };
  visit(step);
  return result;
}
export async function assembleRun(run: Run, selected: Set<string>): Promise<FileMap> {
  const files = await readTree(run.base, run.config.value.limits);
  if ((await treeHash(files)) !== run.base_hash)
    throw new TitanError(ErrorCode.BaseChanged, RunnerMessage.BaseChanged);
  const owners = new Map<string, string>();
  const pending = await all(
    run.plan.nodes
      .filter((step) => selected.has(step.id))
      .map((step) => () => readSnapshot(run, step)),
  );
  const done = new Set<string>();
  while (pending.length) {
    const index = pending.findIndex(([step]) =>
      (step.needs ?? []).every((id) => !selected.has(id) || done.has(id)),
    );
    if (index < 0) throw new TitanError(ErrorCode.AssemblyCycle, RunnerMessage.AssemblyCycle);
    const entry = pending.splice(index, 1)[0];
    if (!entry) break;
    const [step, state, changed] = entry;
    mergeRun(run, step, state, files, changed, owners);
    assertManifestBounds(files, run.config.value.limits);
    done.add(step.id);
  }
  return files;
}
async function readSnapshot(run: Run, step: Step) {
  const state = run.nodes[step.id];
  if (!state?.snapshot || state.state !== StepStatus.Passed)
    throw new TitanError(ErrorCode.MissingSnapshot, step.id);
  const changed = await readTree(state.snapshot, run.config.value.limits);
  const manifest = resolve(state.snapshot, PathPart.Parent, RunFile.CandidateHash);
  const checksum = await treeHash(changed);
  const committed = state.phases[ExecutionPhase.Worker]?.candidate_hash;
  if (
    !(await exists(manifest)) ||
    checksum !== (await readFileBytes(manifest, IoLimit.HashBytes)).toString(FileEncoding.Utf8) ||
    (committed !== undefined && checksum !== committed)
  )
    throw new TitanError(ErrorCode.SnapshotChanged, step.id);
  return [step, state, changed] as const;
}
function mergeRun(
  run: Run,
  step: Step,
  state: NodeState,
  files: FileMap,
  changed: FileMap,
  owners: Map<string, string>,
): void {
  const ancestors = runParents(run, step);
  for (const [path, checksum] of Object.entries(state.changes)) {
    const owner = owners.get(path);
    const value = changed[path];
    if (
      owner &&
      !liveRun(run) &&
      !ancestors.has(owner) &&
      fileIdentity(files[path]) !== fileIdentity(value)
    )
      throw new TitanError(ErrorCode.FileConflict, fileConflict(path, owner, step.id));
    if (checksum === null) delete files[path];
    else if (value !== undefined && fileIdentity(value) === checksum) files[path] = value;
    else throw new TitanError(ErrorCode.SnapshotChanged, stepReference(step.id, path));
    owners.set(path, step.id);
  }
}

export async function verifyCandidate(
  run: Run,
  step: Step,
  candidate: string,
  files?: FileMap,
  committed = run.nodes[step.id]?.phases[ExecutionPhase.Worker]?.candidate_hash,
): Promise<void> {
  if (
    !(await exists(candidate)) ||
    !(await exists(resolve(candidate, PathPart.Parent, RunFile.CandidateHash)))
  )
    throw new TitanError(ErrorCode.MissingCheckpoint, step.id);
  files ??= await readTree(candidate, run.config.value.limits);
  const checksum = await treeHash(files);
  if (
    checksum !==
      (
        await readFileBytes(
          resolve(candidate, PathPart.Parent, RunFile.CandidateHash),
          IoLimit.HashBytes,
        )
      ).toString(FileEncoding.Utf8) ||
    (committed !== undefined && checksum !== committed)
  )
    throw new TitanError(ErrorCode.CheckpointChanged, step.id);
}

export async function verifyAttemptInput(run: Run, step: Step, input: string): Promise<FileMap> {
  if (!(await exists(input))) throw new TitanError(ErrorCode.MissingCheckpoint, step.id);
  if (liveRun(run)) return readTree(input, run.config.value.limits);
  const expected = await assembleRun(run, runParents(run, step));
  const files = await readTree(input, run.config.value.limits);
  if ((await treeHash(files)) !== (await treeHash(expected)))
    throw new TitanError(ErrorCode.CheckpointChanged, RunnerMessage.InputCheckpoint);
  return files;
}
