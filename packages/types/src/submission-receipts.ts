import { ServerLimit, SubmissionReceipt } from "@titan/constants";
import { z } from "zod";
import { Sha256Schema } from "./hash.ts";

const identity = z.string().min(1).max(ServerLimit.IdentityCharacters);
export const ClientSettingsSchema = z.strictObject({
  max_submission_receipts: z.number().int().positive().max(SubmissionReceipt.Maximum),
});
export const SubmissionReceiptSchema = z.strictObject({
  client_id: identity,
  submission_id: identity,
  request_hash: Sha256Schema,
  schema_version: z.literal(SubmissionReceipt.Version),
});
export type SubmissionReceiptRecord = z.infer<typeof SubmissionReceiptSchema>;
export const SubmissionReceiptInputSchema = z.strictObject({
  client_id: identity.optional(),
  submission_id: identity.optional(),
  request_hash: Sha256Schema,
  max_receipts: ClientSettingsSchema.shape.max_submission_receipts.default(
    SubmissionReceipt.Maximum,
  ),
});
export type SubmissionReceiptOptions = z.output<typeof SubmissionReceiptInputSchema>;
export type SubmissionReceiptInput = z.input<typeof SubmissionReceiptInputSchema>;
export const SubmissionReceiptCountSchema = z.strictObject({
  count: z.number().int().nonnegative(),
});
