import { BoardLimit, CliOutput, CliRecoveryAction, RunStatus, ServerLimit } from "@titan/constants";
import { z } from "zod";
import { EventPageSchema, RunEventViewSchema } from "./board.ts";

const identity = z.string().min(1).max(ServerLimit.IdentityCharacters);
export const CliOutputOperationSchema = z.string().min(1).max(CliOutput.OperationCharacters);
export const CliOutputIdentitySchema = z.object({
  run_id: identity.optional(),
  workflow_id: z.string().min(1).optional(),
  client_id: identity.optional(),
  submission_id: identity.optional(),
  harness_session_id: identity.optional(),
});
export const CliRecoverySchema = z.strictObject({
  action: z.enum(CliRecoveryAction),
  run_id: identity.nullable(),
  client_id: identity.nullable(),
  submission_id: identity.nullable(),
  receipt_path: z.string().min(1).nullable(),
});
export const CliOutputErrorSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string(),
  paths: z.array(z.string()),
  retryable: z.boolean(),
  recovery: CliRecoverySchema.nullable(),
});
export const CliOutputSchema = z
  .strictObject({
    schema_version: z.literal(CliOutput.Version),
    operation: CliOutputOperationSchema,
    identifiers: z.strictObject({
      run_id: identity.nullable(),
      workflow_id: z.string().min(1).nullable(),
      client_id: identity.nullable(),
      submission_id: identity.nullable(),
      harness_session_id: identity.nullable(),
    }),
    state: z.enum(RunStatus).nullable(),
    data: z.unknown().refine((value) => value !== undefined),
    error: CliOutputErrorSchema.nullable(),
    events: z.array(RunEventViewSchema).max(BoardLimit.EventPageSize),
    after: EventPageSchema.shape.after.nullable(),
    next_cursor: EventPageSchema.shape.next_cursor.nullable(),
    has_more: z.boolean(),
    truncated: z.boolean(),
  })
  .refine((envelope) =>
    envelope.after === null
      ? envelope.events.length === 0 &&
        envelope.next_cursor === null &&
        !envelope.has_more &&
        !envelope.truncated
      : envelope.truncated === envelope.has_more &&
        EventPageSchema.safeParse({
          schema_version: BoardLimit.EventPageVersion,
          run_id: envelope.identifiers.run_id,
          after: envelope.after,
          events: envelope.events,
          next_cursor: envelope.next_cursor,
          has_more: envelope.has_more,
        }).success,
  );
export type CliOutputEnvelope = z.infer<typeof CliOutputSchema>;
export const CliFailureOutputSchema = CliOutputSchema.safeExtend({
  data: z.null(),
  state: z.null(),
  error: CliOutputErrorSchema,
});
export type CliFailureOutput = z.infer<typeof CliFailureOutputSchema>;
export const CliOutputContextSchema = z.strictObject({
  operation: CliOutputOperationSchema,
  events: EventPageSchema.optional(),
});
export type CliOutputContext = z.infer<typeof CliOutputContextSchema>;
export const CliEventLineSchema = RunEventViewSchema.extend({
  schema_version: z.literal(CliOutput.Version),
  run_id: identity,
});
