import { ErrorCode, KnowledgeLimit } from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { jsonBytes } from "@titan/streams";
import {
  type KnowledgeChange,
  KnowledgeCommitSchema,
  KnowledgeDraftSchema,
  type KnowledgeMutation,
  type KnowledgePublicationJournal,
} from "@titan/types";

export function publicationMutations(journal: KnowledgePublicationJournal): KnowledgeMutation[] {
  return KnowledgeCommitSchema.parse({
    publication_id: journal.publication_id,
    mutations: journal.changes.map(changeMutation),
  }).mutations;
}

export function changeMutation(change: KnowledgeChange) {
  return {
    id: change.before?.id ?? change.after?.id,
    version: change.before?.version ?? null,
    entry: change.after ? KnowledgeDraftSchema.strip().parse(change.after) : null,
  };
}

export async function publicationHash(mutations: KnowledgeMutation[]): Promise<string> {
  return hash(await jsonBytes(mutations, KnowledgeLimit.PublicationBytes));
}

export async function validatePublication(journal: KnowledgePublicationJournal): Promise<void> {
  if (journal.input_hash !== (await publicationHash(publicationMutations(journal))))
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
}

export function publicationChanges(mutations: KnowledgeMutation[]) {
  return mutations.map((mutation) => ({
    id: mutation.id,
    version: mutation.entry ? (mutation.version ?? 0) + 1 : mutation.version,
    deleted: mutation.entry === null,
  }));
}
