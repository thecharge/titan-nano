import { chmod, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ErrorCode,
  ServerDatabaseAdapter,
  ServerLimit,
  SubmissionReceipt,
  SubmissionReceiptSql,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { SubmissionReceiptMessage } from "@titan/messages";
import {
  SubmissionReceiptCountSchema,
  type SubmissionReceiptInput,
  SubmissionReceiptInputSchema,
  type SubmissionReceiptOptions,
  type SubmissionReceiptRecord,
  SubmissionReceiptSchema,
} from "@titan/types";

async function reserve(
  database: Bun.SQL,
  options: SubmissionReceiptOptions,
): Promise<SubmissionReceiptRecord> {
  const submission = options.submission_id ?? newId();
  const rows =
    options.client_id === undefined
      ? await database.unsafe(SubmissionReceiptSql.Submission, [submission])
      : await database.unsafe(SubmissionReceiptSql.Pair, [options.client_id, submission]);
  if (rows.length > 1)
    throw new TitanError(ErrorCode.SubmissionReceipt, SubmissionReceiptMessage.Ambiguous);
  const previous = SubmissionReceiptSchema.optional().parse(rows[0]);
  if (previous && previous.request_hash !== options.request_hash)
    throw new TitanError(ErrorCode.SubmissionConflict, SubmissionReceiptMessage.Conflict);
  if (previous) return previous;
  const count = SubmissionReceiptCountSchema.parse(
    (await database.unsafe(SubmissionReceiptSql.Count))[0],
  );
  if (count.count >= options.max_receipts)
    throw new TitanError(ErrorCode.SubmissionReceipt, SubmissionReceiptMessage.Full);
  const receipt = SubmissionReceiptSchema.parse({
    client_id: options.client_id ?? newId(),
    submission_id: submission,
    request_hash: options.request_hash,
    schema_version: SubmissionReceipt.Version,
  });
  assertNoSecrets(Buffer.from(JSON.stringify(receipt)));
  await database.unsafe(SubmissionReceiptSql.Insert, [
    receipt.client_id,
    receipt.submission_id,
    receipt.request_hash,
    receipt.schema_version,
  ]);
  return receipt;
}

export async function prepareSubmission(
  home: string,
  input: SubmissionReceiptInput,
): Promise<SubmissionReceiptRecord> {
  const parsed = SubmissionReceiptInputSchema.safeParse(input);
  if (!parsed.success)
    throw new TitanError(ErrorCode.SubmissionReceipt, SubmissionReceiptMessage.Invalid);
  await mkdir(home, { recursive: true, mode: ServerLimit.DirectoryMode });
  const file = resolve(home, SubmissionReceipt.File);
  const database = new Bun.SQL({ adapter: ServerDatabaseAdapter, filename: file, strict: true });
  try {
    for (const query of SubmissionReceiptSql.Initialize) await database.unsafe(query);
    await chmod(file, ServerLimit.FileMode);
    await database.unsafe(SubmissionReceiptSql.Begin);
    const receipt = await reserve(database, parsed.data);
    await database.unsafe(SubmissionReceiptSql.Commit);
    return receipt;
  } catch (error) {
    if (error instanceof TitanError) throw error;
    throw new TitanError(ErrorCode.SubmissionReceipt, SubmissionReceiptMessage.Unavailable);
  } finally {
    await database.close();
  }
}
