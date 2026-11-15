import { opendir } from "node:fs/promises";
import { join } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ErrorCode,
  FileEncoding,
  KnowledgeAttemptFile,
  KnowledgeAttemptFormat,
  KnowledgeAttemptLimit,
  KnowledgeAttemptQueue,
  KnowledgeAttemptState,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { KeyedQueue } from "@titan/store";
import { atomicWrite, jsonBytes } from "@titan/streams";
import {
  type AsyncTask,
  type KnowledgeAttemptDocument,
  KnowledgeAttemptDocumentSchema,
  type KnowledgeAttemptInspection,
  type KnowledgeAttemptScope,
  KnowledgeAttemptScopeSchema,
  type KnowledgeAttemptSettingsInput,
  KnowledgeAttemptSettingsSchema,
  KnowledgeAttemptStageSchema,
} from "@titan/types";
import { publicationChanges, publicationHash } from "./commit-format.ts";
import { knowledgeAttemptPath, knowledgeDirectory, optionalKnowledgeBytes } from "./files.ts";
import type { KnowledgeHub } from "./hub.ts";

export class KnowledgeAttempts {
  private queue;
  private settings;
  private directory;
  private closing = false;

  constructor(
    home: string,
    private hub: KnowledgeHub,
    input: KnowledgeAttemptSettingsInput | undefined,
    pending: number,
    private active: () => boolean,
    private healthy: () => boolean,
  ) {
    this.settings = KnowledgeAttemptSettingsSchema.parse(input ?? {});
    this.queue = new KeyedQueue(pending);
    this.directory = join(home, KnowledgeAttemptFile.Directory);
  }

  private async use<T>(action: AsyncTask<T>): Promise<T> {
    if (this.closing || !this.active())
      throw new TitanError(ErrorCode.KnowledgeUnavailable, KnowledgeMessage.Unavailable);
    return this.queue.use(KnowledgeAttemptQueue, async () => {
      if (!this.healthy())
        throw new TitanError(ErrorCode.KnowledgeUnavailable, KnowledgeMessage.Unavailable);
      return action();
    });
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.queue.drain(KnowledgeAttemptQueue);
  }

  private scope(input: unknown): KnowledgeAttemptScope {
    const parsed = KnowledgeAttemptScopeSchema.safeParse(input);
    if (!parsed.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Pending);
    return parsed.data;
  }

  private path(scope: KnowledgeAttemptScope): string {
    return knowledgeAttemptPath(this.directory, scope);
  }

  private async load(scope: KnowledgeAttemptScope) {
    await knowledgeDirectory(this.directory);
    const bytes = await optionalKnowledgeBytes(
      this.path(scope),
      KnowledgeAttemptLimit.DocumentBytes,
    );
    if (bytes === null) return null;
    try {
      assertNoSecrets(bytes);
      const document = KnowledgeAttemptDocumentSchema.parse(
        JSON.parse(bytes.toString(FileEncoding.Utf8)),
      );
      if (JSON.stringify(document.scope) !== JSON.stringify(scope))
        throw new Error(KnowledgeMessage.Pending);
      await this.validateReceipt(document);
      return document;
    } catch {
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Pending);
    }
  }

  private async validateReceipt(document: KnowledgeAttemptDocument): Promise<void> {
    if (!document.receipt) return;
    if (
      document.receipt.input_hash !== (await publicationHash(document.mutations)) ||
      JSON.stringify(document.receipt.changes) !==
        JSON.stringify(publicationChanges(document.mutations))
    )
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.PublicationReceipt);
  }

  read(input: unknown) {
    const scope = this.scope(input);
    return this.use(() => this.load(scope));
  }

  inspect<T>(input: unknown, read: KnowledgeAttemptInspection<T>): Promise<T> {
    const scope = this.scope(input);
    return this.use(async () => read(await this.load(scope)));
  }

  stage(input: unknown, change: unknown) {
    const scope = this.scope(input);
    const parsed = KnowledgeAttemptStageSchema.safeParse(change);
    if (!parsed.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Pending);
    return this.use(async () => {
      const previous = await this.load(scope);
      if (previous?.state !== undefined && previous.state !== KnowledgeAttemptState.Open)
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.PendingClosed);
      if ((previous?.revision ?? null) !== parsed.data.revision)
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
      if (!previous) await this.admit();
      const next = KnowledgeAttemptDocumentSchema.safeParse({
        schema_version: KnowledgeAttemptFormat.Version,
        scope,
        publication_id: previous?.publication_id ?? newId(),
        revision: (previous?.revision ?? 0) + 1,
        state: KnowledgeAttemptState.Open,
        mutations: parsed.data.mutations,
        receipt: null,
      });
      if (!next.success) throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Pending);
      await this.save(next.data, true);
      return next.data;
    });
  }

  private async admit(): Promise<void> {
    let count = 0;
    for await (const file of await opendir(this.directory)) {
      if (!file.isFile())
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Pending);
      if (++count >= this.settings.max_sets)
        throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
    }
  }

  private async save(document: KnowledgeAttemptDocument, admission: boolean): Promise<void> {
    if (admission && document.mutations.length > this.settings.max_entries)
      throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
    const bytes = await jsonBytes(
      document,
      admission ? this.settings.max_bytes : KnowledgeAttemptLimit.DocumentBytes,
    );
    assertNoSecrets(bytes);
    await atomicWrite(this.path(document.scope), bytes);
  }

  private async current(scope: KnowledgeAttemptScope, revision: number) {
    const document = await this.load(scope);
    if (!document) throw new TitanError(ErrorCode.KnowledgeMissing, KnowledgeMessage.Missing);
    if (document.revision !== revision)
      throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
    return document;
  }

  publish(input: unknown, revision: number) {
    const scope = this.scope(input);
    return this.use(async () => {
      const document = await this.current(scope, revision);
      if (document.state === KnowledgeAttemptState.Published) return document;
      if (document.state === KnowledgeAttemptState.Discarded)
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.PendingClosed);
      if (document.mutations.length)
        document.receipt = await this.hub.commit(
          { publication_id: document.publication_id, mutations: document.mutations },
          async () => {
            document.state = KnowledgeAttemptState.Prepared;
            await this.save(document, false);
          },
        );
      document.state = KnowledgeAttemptState.Published;
      await this.save(document, false);
      return document;
    });
  }

  discard(input: unknown, revision: number) {
    const scope = this.scope(input);
    return this.use(async () => {
      const document = await this.current(scope, revision);
      if (document.state === KnowledgeAttemptState.Discarded) return document;
      if (document.state !== KnowledgeAttemptState.Open)
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.PendingClosed);
      document.state = KnowledgeAttemptState.Discarded;
      document.mutations = [];
      await this.save(document, false);
      return document;
    });
  }
}
