import { resolve } from "node:path";
import { atomicWrite, collectProofReport, RunStore } from "@titan/board";
import { BoardLimit, RunArtifactFile } from "@titan/constants";
import { hash } from "@titan/core";
import { jsonBytes } from "@titan/streams";
import type { Run } from "@titan/types";

export async function writeProofReport(run: Run): Promise<string> {
  const report = await collectProofReport(run, new RunStore(run.root).events(run.version));
  const content = await jsonBytes(report, BoardLimit.RecordBytes);
  await atomicWrite(resolve(run.root, RunArtifactFile.Proofs), content);
  return hash(content);
}
