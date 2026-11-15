import {
  CliOutput,
  CliOutputOperation,
  CliRecoveryAction,
  DataKind,
  ErrorCode,
  RunStatus,
} from "@titan/constants";
import {
  errorMessage,
  OperationalError,
  RunObservationError,
  SubmissionUncertainError,
  TitanError,
} from "@titan/errors";
import { CliDiagnostic, CliOutputMessage } from "@titan/messages";
import {
  type CliFailureOutput,
  CliFailureOutputSchema,
  type CliOutputContext,
  type CliOutputEnvelope,
  CliOutputIdentitySchema,
  CliOutputOperationSchema,
  CliOutputSchema,
  EventPageSchema,
  RunSnapshotSchema,
} from "@titan/types";
import { resolveCommand } from "./catalog.ts";
import { parseRaw } from "./options.ts";

export function outputOperation(args: string[]): string {
  try {
    const { values, positionals } = parseRaw(args);
    if (values.version) return CliOutputOperation.Version;
    if (!positionals.length) return CliOutputOperation.Help;
    const { name } = resolveCommand(positionals);
    return CliOutputOperationSchema.safeParse(name).data ?? CliOutputOperation.Unknown;
  } catch {
    return CliOutputOperation.Unknown;
  }
}

export function outputEnvelope(value: unknown, context: CliOutputContext): CliOutputEnvelope {
  const identity = CliOutputIdentitySchema.safeParse(value).data;
  const run = RunSnapshotSchema.safeParse(value).data;
  const page = context.events ?? EventPageSchema.safeParse(value).data;
  const blocked = run?.state === RunStatus.Blocked;
  const recovery = blocked
    ? {
        action: CliRecoveryAction.Resume,
        run_id: run.run_id,
        client_id: identity?.client_id ?? null,
        submission_id: identity?.submission_id ?? null,
        receipt_path: null,
      }
    : null;
  return CliOutputSchema.parse({
    schema_version: CliOutput.Version,
    operation: context.operation,
    identifiers: {
      run_id: identity?.run_id ?? null,
      workflow_id: identity?.workflow_id ?? null,
      client_id: identity?.client_id ?? null,
      submission_id: identity?.submission_id ?? null,
      harness_session_id: identity?.harness_session_id ?? null,
    },
    state: run?.state ?? null,
    data: value ?? null,
    error: blocked
      ? {
          code: ErrorCode.ExecutionInterrupted,
          message: typeof run.error === DataKind.String ? run.error : CliOutputMessage.Blocked,
          paths: [],
          retryable: false,
          recovery,
        }
      : null,
    events: page?.events ?? [],
    after: page?.after ?? null,
    next_cursor: page?.next_cursor ?? null,
    has_more: page?.has_more ?? false,
    truncated: page?.has_more ?? false,
  });
}

export function failureEnvelope(error: unknown, operation: string): CliFailureOutput {
  const envelope = outputEnvelope(null, { operation });
  const uncertain = error instanceof SubmissionUncertainError ? error : null;
  const observation = error instanceof RunObservationError ? error : null;
  envelope.identifiers.run_id = observation?.run_id ?? null;
  envelope.identifiers.client_id = uncertain?.client_id ?? null;
  envelope.identifiers.submission_id = uncertain?.submission_id ?? null;
  envelope.error = {
    code: error instanceof TitanError ? error.code : CliDiagnostic.UnknownError,
    message: errorMessage(error),
    paths: error instanceof TitanError ? error.paths : [],
    retryable:
      error instanceof OperationalError ? error.retryable : Boolean(uncertain || observation),
    recovery:
      uncertain || observation
        ? {
            action: uncertain ? CliRecoveryAction.RetrySubmission : CliRecoveryAction.Observe,
            run_id: observation?.run_id ?? null,
            client_id: uncertain?.client_id ?? null,
            submission_id: uncertain?.submission_id ?? null,
            receipt_path: uncertain?.receipt_path ?? null,
          }
        : null,
  };
  return CliFailureOutputSchema.parse(envelope);
}
