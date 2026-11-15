import { opendir } from "node:fs/promises";
import { join } from "node:path";
import { ErrorCode, FileEncoding, KnowledgeFile, KnowledgeLimit } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { atomicWrite, jsonBytes } from "@titan/streams";
import {
  type KnowledgePublicationReceipt,
  KnowledgePublicationReceiptSchema,
  KnowledgeSelectionSchema,
  type KnowledgeSettings,
} from "@titan/types";
import { knowledgeDirectory, optionalKnowledgeBytes } from "./files.ts";

function receiptPath(root: string, id: string): string {
  KnowledgeSelectionSchema.parse({ id });
  return join(root, KnowledgeFile.Publications, id + KnowledgeFile.Json);
}

export async function readPublicationReceipt(root: string, id: string) {
  await knowledgeDirectory(join(root, KnowledgeFile.Publications));
  const bytes = await optionalKnowledgeBytes(receiptPath(root, id), KnowledgeLimit.ReceiptBytes);
  if (bytes === null) return null;
  try {
    const receipt = KnowledgePublicationReceiptSchema.parse(
      JSON.parse(bytes.toString(FileEncoding.Utf8)),
    );
    if (receipt.publication_id !== id) throw new Error(KnowledgeMessage.PublicationReceipt);
    return receipt;
  } catch {
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.PublicationReceipt);
  }
}

export async function admitPublicationReceipt(
  root: string,
  settings: KnowledgeSettings,
): Promise<void> {
  const directory = join(root, KnowledgeFile.Publications);
  await knowledgeDirectory(directory);
  let count = 0;
  for await (const file of await opendir(directory)) {
    if (!file.isFile())
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.PublicationReceipt);
    if (++count >= (settings.max_publication_receipts ?? KnowledgeLimit.PublicationReceipts))
      throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
  }
}

export async function writePublicationReceipt(
  root: string,
  input: KnowledgePublicationReceipt,
): Promise<void> {
  const receipt = KnowledgePublicationReceiptSchema.parse(input);
  await knowledgeDirectory(join(root, KnowledgeFile.Publications));
  const previous = await readPublicationReceipt(root, receipt.publication_id);
  const bytes = await jsonBytes(receipt, KnowledgeLimit.ReceiptBytes);
  if (previous && JSON.stringify(previous) !== JSON.stringify(receipt))
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.PublicationReceipt);
  if (!previous) await atomicWrite(receiptPath(root, receipt.publication_id), bytes);
}
