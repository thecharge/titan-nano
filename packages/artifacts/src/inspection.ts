import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore, runResultChunks } from "@titan/board";
import {
  ArtifactFormat,
  ArtifactKind,
  BoardLimit,
  ErrorCode,
  FileEncoding,
  HashAlgorithm,
  IoLimit,
  RunArtifactFile,
  RunEventKind,
  RunFile,
  RunResultFormat,
  RunStatus,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { ArtifactMessage, resultDocument } from "@titan/messages";
import { jsonBytes, readFileBytes } from "@titan/streams";
import {
  type ArtifactCommit,
  ArtifactCommitSchema,
  type ArtifactInspection,
  ArtifactInspectionSchema,
  ArtifactManifestSchema,
  type Run,
  RunSchema,
  ScriptCaptureOutputSchema,
  ScriptProofReportSchema,
} from "@titan/types";
import { readRetainedFile, readTree, sourceChunks, treeHash } from "@titan/workspace";

async function ordinary(path: string, directory: boolean): Promise<void> {
  const entry = await lstat(path);
  if (entry.isSymbolicLink() || (directory ? !entry.isDirectory() : !entry.isFile()))
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
}

async function deliveryState(run: Run): Promise<string> {
  try {
    const state = { ...RunSchema.parse(run), version: 0 };
    delete state.proofs;
    return hash(await jsonBytes(state, BoardLimit.RecordBytes));
  } catch {
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
  }
}

async function committedHash(run: Run): Promise<ArtifactCommit> {
  const expected = await deliveryState(run);
  let committed: ArtifactCommit | null = null;
  let through = 0;
  for await (const event of new RunStore(run.root).events(run.version)) {
    through = event.id;
    if (
      event.type === RunEventKind.Passed &&
      committed === null &&
      (await deliveryState(event.state)) !== expected
    )
      throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
    if (event.type === RunEventKind.Passed && committed === null) {
      committed = ArtifactCommitSchema.parse(event.data);
      continue;
    }
    if (
      committed !== null &&
      ((event.type !== RunEventKind.RequestOpened &&
        event.type !== RunEventKind.RequestAnswered &&
        event.type !== RunEventKind.RequestEscalated) ||
        (await deliveryState(event.state)) !== expected)
    )
      throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
  }
  if (committed === null || through !== run.version)
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
  return committed;
}

async function resultHash(source: AsyncIterable<Uint8Array>, maximum: number): Promise<string> {
  const digest = createHash(HashAlgorithm.Sha256);
  let bytes = 0;
  for await (const chunk of source) {
    bytes += chunk.byteLength;
    if (bytes > maximum) throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
    digest.update(chunk);
  }
  return digest.digest(FileEncoding.Hex);
}

async function inspectProofOutputs(run: Run, proofs: string): Promise<void> {
  const report = ScriptProofReportSchema.parse(
    JSON.parse((await readFileBytes(proofs, BoardLimit.RecordBytes)).toString(FileEncoding.Utf8)),
  );
  for (const check of report.checks) {
    const output = await readRetainedFile(
      run.root,
      check.output,
      check.output_hash,
      BoardLimit.RecordBytes,
    );
    const captures = ScriptCaptureOutputSchema.parse(
      JSON.parse(output.toString(FileEncoding.Utf8)),
    );
    for (const capture of captures.captures) {
      if (!capture.capture) continue;
      await readRetainedFile(
        run.root,
        capture.capture.path,
        capture.capture.hash,
        BoardLimit.RecordBytes,
      );
    }
  }
}

async function inspectDelivery(run: Run): Promise<ArtifactInspection> {
  if (run.state !== RunStatus.Passed || !run.artifacts)
    throw new TitanError(ErrorCode.ArtifactUnavailable, ArtifactMessage.Unavailable);
  const directory = resolve(run.root, RunFile.Artifacts);
  if (run.artifacts !== directory)
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
  const manifest = resolve(run.root, RunArtifactFile.Manifest);
  const result = resolve(run.root, RunArtifactFile.Result);
  await ordinary(run.root, true);
  await ordinary(directory, true);
  await ordinary(manifest, false);
  await ordinary(result, false);
  const kept = ArtifactManifestSchema.parse(
    JSON.parse((await readFileBytes(manifest, IoLimit.DataBytes)).toString(FileEncoding.Utf8)),
  );
  const files = await readTree(directory, run.config.value.limits);
  const paths = Object.keys(files);
  const digest = await treeHash(files);
  const committed = await committedHash(run);
  if (
    digest !== kept.hash ||
    digest !== committed.artifact_hash ||
    kept.result_format !== committed.result_format ||
    kept.proofs_hash !== committed.proofs_hash ||
    JSON.stringify([...paths].sort()) !== JSON.stringify([...kept.paths].sort())
  )
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
  const outputs = Object.fromEntries(
    run.plan.nodes
      .filter((node) => !run.plan.nodes.some((other) => other.needs?.includes(node.id)))
      .map((node) => [node.id, run.nodes[node.id]?.output]),
  );
  if (JSON.stringify(outputs) !== JSON.stringify(kept.outputs))
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
  const maximum = kept.result_format === undefined ? IoLimit.DataBytes : BoardLimit.RecordBytes;
  const expectedResult =
    kept.result_format === undefined
      ? hash(
          Buffer.from(resultDocument(run.plan.workflow.name, run.plan.workflow.goal, kept.outputs)),
        )
      : await resultHash(runResultChunks(run, kept.outputs), maximum);
  if ((await resultHash(sourceChunks(result, false), maximum)) !== expectedResult)
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
  const proofs = resolve(run.root, RunArtifactFile.Proofs);
  if (kept.result_format === RunResultFormat.ProofVersion) {
    await ordinary(proofs, false);
    if (
      (await resultHash(sourceChunks(proofs, false), BoardLimit.RecordBytes)) !== kept.proofs_hash
    )
      throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
    await inspectProofOutputs(run, proofs);
  }
  return ArtifactInspectionSchema.parse({
    schema_version: ArtifactFormat.InspectionVersion,
    run_id: run.run_id,
    workflow_id: run.workflow_id,
    workflow_revision: run.workflow_revision,
    state: run.state,
    directory,
    result,
    manifest,
    ...(kept.result_format === RunResultFormat.ProofVersion ? { proofs } : {}),
    hash: digest,
    files: Object.entries(files).map(([path, file]) => ({
      id: hash(path),
      kind: ArtifactKind.File,
      path,
      hash: file.hash,
      bytes: file.bytes,
      executable: file.executable,
    })),
    outputs: kept.outputs,
  });
}

export async function inspectArtifacts(run: Run): Promise<ArtifactInspection> {
  try {
    return await inspectDelivery(run);
  } catch (error) {
    if (error instanceof TitanError) throw error;
    throw new TitanError(ErrorCode.ArtifactInvalid, ArtifactMessage.Invalid);
  }
}
