import { ErrorCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { BoardMessage } from "@titan/messages";
import { type Run, type RunOrigin, RunOriginSchema } from "@titan/types";

export function retainRunOrigin(run: Run, previous?: RunOrigin): RunOrigin {
  const origin = RunOriginSchema.parse({
    client_id: run.client_id,
    submission_id: run.submission_id,
    harness_session_id: run.harness_session_id,
    runtime_version: run.runtime_version,
    runtime_build: run.runtime_build,
    persona_references: run.persona_references,
  });
  if (
    previous &&
    (previous.harness_session_id !== undefined || origin.harness_session_id !== undefined) &&
    (previous.client_id !== origin.client_id ||
      previous.submission_id !== origin.submission_id ||
      previous.harness_session_id !== origin.harness_session_id)
  )
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  if (previous && previous.runtime_version !== origin.runtime_version)
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  if (previous && previous.runtime_build !== origin.runtime_build)
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  if (
    previous &&
    JSON.stringify(
      previous.persona_references && Object.entries(previous.persona_references).sort(),
    ) !==
      JSON.stringify(origin.persona_references && Object.entries(origin.persona_references).sort())
  )
    throw new TitanError(ErrorCode.CorruptBoard, BoardMessage.Record);
  return previous ?? origin;
}
