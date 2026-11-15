import { join } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ErrorCode,
  FileEncoding,
  KnowledgeFile,
  KnowledgeFormat,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgePublicationStage,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { atomicWrite, jsonBytes } from "@titan/streams";
import {
  type KnowledgeChange,
  KnowledgeCommitSchema,
  KnowledgeEntrySchema,
  type KnowledgeMutation,
  type KnowledgePreparedPublication,
  KnowledgePreparedPublicationSchema,
  type KnowledgePublicationJournal,
  KnowledgePublicationJournalSchema,
  KnowledgePublicationReceiptSchema,
  type KnowledgeReader,
  type KnowledgeSettings,
  type KnowledgeStageObserver,
} from "@titan/types";
import type { KnowledgeCatalog } from "./catalog.ts";
import { publicationChanges, publicationHash, publicationMutations } from "./commit-format.ts";
import { removeKnowledgeFile } from "./files.ts";
import { assertPersonaDefinition } from "./persona-register.ts";
import { publishKnowledgeFiles, verifyCurrent } from "./publication.ts";
import {
  admitPublicationReceipt,
  readPublicationReceipt,
  writePublicationReceipt,
} from "./receipts.ts";

export class KnowledgePublisher {
  constructor(
    private root: string,
    private settings: KnowledgeSettings,
    private catalog: KnowledgeCatalog,
    private read: KnowledgeReader,
  ) {}

  async prepare(input: unknown) {
    const parsed = KnowledgeCommitSchema.safeParse(input);
    if (!parsed.success)
      throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Publication);
    const commit = parsed.data;
    const input_hash = await publicationHash(commit.mutations);
    const previous = await readPublicationReceipt(this.root, commit.publication_id);
    if (previous) {
      if (previous.input_hash !== input_hash)
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
      if (JSON.stringify(previous.changes) !== JSON.stringify(publicationChanges(commit.mutations)))
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.PublicationReceipt);
      return previous;
    }
    if (
      commit.mutations.length >
      (this.settings.max_publication_entries ?? KnowledgeLimit.PublicationEntries)
    )
      throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
    await admitPublicationReceipt(this.root, this.settings);
    const changes: KnowledgeChange[] = [];
    for (const mutation of commit.mutations) changes.push(await this.change(mutation));
    await this.catalog.admitMany(changes);
    const journal = KnowledgePublicationJournalSchema.parse({
      publication_id: commit.publication_id,
      input_hash,
      changes,
    });
    const bytes = await jsonBytes(
      journal,
      this.settings.max_publication_bytes ?? KnowledgeLimit.PublicationBytes,
    );
    assertNoSecrets(bytes);
    return KnowledgePreparedPublicationSchema.parse({ journal, bytes });
  }

  private async change(mutation: KnowledgeMutation): Promise<KnowledgeChange> {
    if (mutation.version === null) {
      if (await this.catalog.get(mutation.id))
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
      return {
        before: null,
        before_text: null,
        after: publicationEntry({ ...mutation.entry, id: mutation.id, version: 1 }),
      };
    }
    const { entry: before, bytes } = await this.read(mutation.id);
    if (before.version !== mutation.version)
      throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
    if (mutation.entry === null && before.kind === KnowledgeKind.Persona)
      throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDeletion);
    if (mutation.entry && mutation.entry.kind !== before.kind)
      throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
    const after = mutation.entry
      ? publicationEntry({
          ...mutation.entry,
          id: before.id,
          version: before.version + 1,
        })
      : null;
    const change = { before, before_text: bytes.toString(FileEncoding.Utf8), after };
    assertPersonaDefinition(change);
    return change;
  }

  async files(
    journal: KnowledgePublicationJournal,
    observe?: KnowledgeStageObserver,
  ): Promise<void> {
    for (const change of journal.changes) await verifyCurrent(this.root, change, this.settings);
    for (const change of journal.changes)
      await publishKnowledgeFiles(this.root, change, this.settings, observe);
  }

  async acknowledge(journal: KnowledgePublicationJournal, revision: string) {
    const receipt = KnowledgePublicationReceiptSchema.parse({
      schema_version: KnowledgeFormat.Version,
      publication_id: journal.publication_id,
      input_hash: journal.input_hash,
      revision,
      changes: publicationChanges(publicationMutations(journal)),
    });
    await writePublicationReceipt(this.root, receipt);
    return receipt;
  }

  async publish(prepared: KnowledgePreparedPublication, observe?: KnowledgeStageObserver) {
    await atomicWrite(join(this.root, KnowledgeFile.Journal), prepared.bytes);
    await observe?.(KnowledgePublicationStage.Journal);
    await this.files(prepared.journal, observe);
    await this.catalog.replaceMany(prepared.journal.changes);
    const revision = await this.catalog.project();
    await observe?.(KnowledgePublicationStage.Index);
    const receipt = await this.acknowledge(prepared.journal, revision);
    await observe?.(KnowledgePublicationStage.Receipt);
    await removeKnowledgeFile(join(this.root, KnowledgeFile.Journal), this.root);
    return receipt;
  }
}

function publicationEntry(input: unknown) {
  const entry = KnowledgeEntrySchema.safeParse(input);
  if (!entry.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
  return entry.data;
}
