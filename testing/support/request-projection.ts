import { strict as assert } from "node:assert";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { RequestProjection, WorkspaceFile } from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { type OperationRequest, RequestProjectionSchema, type Run } from "@titan/types";

export async function projectionMatches(run: Run, requests: OperationRequest[], through?: number) {
  const bytes = await readFileBytes(
    resolve(run.root, RequestProjection.File),
    RequestProjection.MaximumBytes,
  );
  const document = RequestProjectionSchema.parse(JSON.parse(bytes.toString()));
  assert.equal(document.run_id, run.run_id);
  if (through !== undefined) assert.equal(document.through, through);
  assert.deepEqual(
    document.requests.toSorted((left, right) => left.request_id.localeCompare(right.request_id)),
    requests.toSorted((left, right) => left.request_id.localeCompare(right.request_id)),
  );
  assert.ok(
    !(await readdir(run.root)).some((name) => name.endsWith(WorkspaceFile.TemporarySuffix)),
  );
  return bytes;
}
