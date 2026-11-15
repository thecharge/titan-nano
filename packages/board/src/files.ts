import { link, lstat, open } from "node:fs/promises";
import { resolve } from "node:path";
import {
  BoardFile,
  BoardLimit,
  ErrorCode,
  ErrorField,
  FileErrorCode,
  FileOpenMode,
  RunFormat,
  RunResultFormat,
  RunStatus,
} from "@titan/constants";
import { all } from "@titan/core";
import { TitanError } from "@titan/errors";
import { BoardMessage, RunnerMessage } from "@titan/messages";
import { jsonStream } from "@titan/streams";
import { type Run, RunResultSchema } from "@titan/types";
import { runProofSummary } from "./proofs.ts";

export { atomicWrite, atomicWriteStream } from "@titan/streams";

export async function ensureEventLog(root: string): Promise<void> {
  const journal = resolve(root, BoardFile.Journal);
  const events = resolve(root, BoardFile.Events);
  let created = true;
  try {
    await link(journal, events);
  } catch (error) {
    if (!(error instanceof Error) || Reflect.get(error, ErrorField.Code) !== FileErrorCode.Exists)
      throw error;
    created = false;
  }
  const [primary, view] = await all([() => lstat(journal), () => lstat(events)]);
  if (!primary.isFile() || !view.isFile() || primary.ino !== view.ino || primary.dev !== view.dev)
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.EventLog);
  if (!created) return;
  const directory = await open(root, FileOpenMode.Read);
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

export async function* runResultChunks(
  run: Run,
  outputs?: Record<string, unknown>,
): AsyncGenerator<Uint8Array> {
  const steps = Object.fromEntries(
    Object.entries(run.nodes).map(([id, node]) => [
      id,
      {
        state: node.state,
        attempt: node.attempt,
        refutations: node.refutations,
        evidence: node.evidence,
      },
    ]),
  );
  const result = RunResultSchema.parse({
    schema_version:
      run.schema_version >= RunFormat.ProofReports
        ? RunResultFormat.ProofVersion
        : RunResultFormat.FailureVersion,
    run_id: run.run_id,
    workflow_id: run.workflow_id,
    workflow_revision: run.workflow_revision,
    name: run.plan.workflow.name,
    goal: run.plan.workflow.goal,
    state: outputs === undefined ? RunStatus.Failed : RunStatus.Passed,
    steps,
    ...(outputs === undefined ? {} : { outputs }),
  });
  yield Buffer.from(
    outputs === undefined ? RunnerMessage.FailedResultPrefix : RunnerMessage.PassedResultPrefix,
  );
  yield* jsonStream(result, BoardLimit.RecordBytes);
  yield Buffer.from(RunnerMessage.FailedResultSuffix);
  if (run.schema_version >= RunFormat.ProofReports) {
    const proofs = runProofSummary(run);
    yield Buffer.from(RunnerMessage.ProofSummary(proofs.proven, proofs.total));
  }
  const counts = new Map<string, number>();
  for (const node of Object.values(run.nodes))
    for (const kind of node.failures ?? []) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  if (!counts.size) return;
  yield Buffer.from(RunnerMessage.FailureKindsHeading);
  for (const [kind, count] of counts) yield Buffer.from(RunnerMessage.FailureKindLine(kind, count));
}
