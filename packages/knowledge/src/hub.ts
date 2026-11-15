import { chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ErrorCode,
  FileEncoding,
  KnowledgeCommand,
  KnowledgeField,
  KnowledgeFile,
  KnowledgeFormat,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgePublicationStage,
  KnowledgeQueueKey,
  KnowledgeSearchMode,
  KnowledgeSql,
  PathPart,
  PersonaDecisionStage,
  PersonaState,
  RunEventKind,
  ServerDatabaseAdapter,
  ServerLimit,
  TextSymbol,
} from "@titan/constants";
import { all, hash, newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { KeyedQueue } from "@titan/store";
import {
  type AsyncTask,
  type KnowledgeAttemptScope,
  type KnowledgeChange,
  KnowledgeDeleteSchema,
  KnowledgeEntrySchema,
  KnowledgeHistoryPageSchema,
  KnowledgeHistoryQuerySchema,
  KnowledgeInputSchema,
  KnowledgeMaintenanceQuerySchema,
  type KnowledgeMeaning,
  type KnowledgeMeaningRuntime,
  KnowledgeReadResultSchema,
  KnowledgeSearchSchema,
  KnowledgeSelectionSchema,
  type KnowledgeSettings,
  type KnowledgeSettingsInput,
  KnowledgeSettingsSchema,
  type KnowledgeStageObserver,
  KnowledgeStatsSchema,
  KnowledgeUpdateSchema,
  type OperationRequest,
  PersonaJudgementSchema,
  type PersonaQualityResult,
  type PersonaRequest,
  type PersonaRequestWriter,
  type PersonaUsageReport,
  type Run,
  type RunEvent,
  type Workflow,
} from "@titan/types";
import { archivedKnowledge } from "./archived.ts";
import { KnowledgeAttemptSearch } from "./attempt-search.ts";
import { KnowledgeAttempts } from "./attempts.ts";
import { KnowledgeCatalog } from "./catalog.ts";
import { KnowledgePublisher } from "./commit.ts";
import { changeMutation } from "./commit-format.ts";
import { knowledgeDates } from "./dates.ts";
import {
  assertKnowledgeFile,
  knowledgeDirectory,
  knowledgePath,
  readKnowledgeBytes,
  removeKnowledgeFile,
} from "./files.ts";
import { knowledgeBytes, parseKnowledgeEntry } from "./format.ts";
import { knowledgeHistory } from "./history.ts";
import { maintenancePlan } from "./maintenance.ts";
import { blendMeaning, KnowledgeMeaningSearch } from "./meaning.ts";
import { registeredOpenCall } from "./open-call.ts";
import { archivedPersona, readPersonaEntry } from "./persona-archive.ts";
import { publishPersonaDecision } from "./persona-decision.ts";
import { personaHistory } from "./persona-lifecycle.ts";
import { publishPersonaQuality } from "./persona-quality.ts";
import { assertPersonaDefinition, PersonaRegistry } from "./persona-register.ts";
import { publishPersonaUsage } from "./persona-usage.ts";
import {
  publishKnowledgeFiles,
  readKnowledgeChange,
  recordKnowledgeChange,
} from "./publication.ts";
import { searchResults } from "./search.ts";
import { KnowledgeView } from "./view.ts";

export class KnowledgeHub {
  private failed = false;
  private closing = false;
  private stopping?: Promise<void>;
  private revision = hash(TextSymbol.Empty);
  private queue;
  private catalog;
  private publisher;
  private pending?: KnowledgeAttempts;
  private scopedSearch?: KnowledgeAttemptSearch;
  private meaning?: KnowledgeMeaningSearch;

  view(scope: KnowledgeAttemptScope) {
    return new KnowledgeView(this, scope, this.settings.max_entry_bytes);
  }

  get attempts() {
    this.pending ??= new KnowledgeAttempts(
      resolve(this.root, PathPart.Parent),
      this,
      this.settings.attempts,
      this.settings.max_pending_operations,
      () => !this.failed && !this.closing,
      () => !this.failed,
    );
    return this.pending;
  }

  private constructor(
    private root: string,
    private settings: KnowledgeSettings,
    database: Bun.SQL,
    private lifetime: AsyncDisposableStack,
    private observe?: KnowledgeStageObserver,
    runtime?: KnowledgeMeaningRuntime,
  ) {
    this.queue = new KeyedQueue(settings.max_pending_operations);
    this.catalog = new KnowledgeCatalog(database, root, settings);
    this.publisher = new KnowledgePublisher(root, settings, this.catalog, (id) => this.read(id));
    if (runtime)
      this.meaning = new KnowledgeMeaningSearch(runtime, this.catalog, (id) => this.read(id));
  }

  static async open(
    home: string,
    input: KnowledgeSettingsInput = {},
    observe?: KnowledgeStageObserver,
    meaning?: KnowledgeMeaning,
  ) {
    home = resolve(home);
    const settings = KnowledgeSettingsSchema.parse(input);
    await using resources = new AsyncDisposableStack();
    await knowledgeDirectory(home);
    await ownKnowledge(home, resources);
    const path = join(home, KnowledgeFile.Database);
    for (const suffix of KnowledgeFile.SqliteSidecars) await assertKnowledgeFile(path + suffix);
    const database = new Bun.SQL({ adapter: ServerDatabaseAdapter, filename: path, strict: true });
    resources.defer(() => database.close());
    const root = join(home, KnowledgeFile.Directory);
    const runtime = await openMeaning(meaning, resources);
    const hub = new KnowledgeHub(root, settings, database, resources, observe, runtime);
    await hub.initialize();
    await chmod(path, ServerLimit.FileMode);
    hub.lifetime = resources.move();
    return hub;
  }

  private async initialize(): Promise<void> {
    await knowledgeDirectory(this.root);
    for (const kind of Object.values(KnowledgeKind))
      await knowledgeDirectory(join(this.root, kind));
    await this.catalog.initialize();
    if (this.meaning) await this.catalog.adoptEmbedder(this.meaning.name);
    const pending = await readKnowledgeChange(this.root, this.settings);
    if (pending) {
      if (KnowledgeField.Publication in pending) await this.publisher.files(pending);
      else await publishKnowledgeFiles(this.root, pending, this.settings);
    }
    await this.catalog.rebuild();
    this.revision = await this.catalog.project();
    if (pending && KnowledgeField.Publication in pending)
      await this.publisher.acknowledge(pending, this.revision);
    if (pending) await removeKnowledgeFile(join(this.root, KnowledgeFile.Journal), this.root);
  }

  private async use<T>(action: AsyncTask<T>): Promise<T> {
    if (this.closing)
      throw new TitanError(ErrorCode.KnowledgeUnavailable, KnowledgeMessage.Unavailable);
    return this.queue.use(KnowledgeQueueKey, async () => {
      if (this.failed)
        throw new TitanError(ErrorCode.KnowledgeUnavailable, KnowledgeMessage.Unavailable);
      return action();
    });
  }

  close(): Promise<void> {
    this.closing = true;
    this.stopping ??= this.dispose();
    return this.stopping;
  }

  private async dispose(): Promise<void> {
    await this.pending?.close();
    await this.queue.drain(KnowledgeQueueKey);
    this.failed = true;
    await this.lifetime.disposeAsync();
  }

  private async read(id: string) {
    if (!KnowledgeSelectionSchema.safeParse({ id }).success)
      throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
    const row = await this.catalog.get(id);
    if (!row) throw new TitanError(ErrorCode.KnowledgeMissing, KnowledgeMessage.Missing);
    const bytes = await readKnowledgeBytes(
      knowledgePath(this.root, row.kind, row.id),
      this.settings.max_entry_bytes,
    );
    assertNoSecrets(bytes);
    const entry = parseKnowledgeEntry(bytes, this.settings.max_entry_bytes);
    if (
      entry.id !== id ||
      entry.kind !== row.kind ||
      entry.version !== row.version ||
      hash(bytes) !== row.hash
    )
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    return KnowledgeReadResultSchema.parse({ entry, bytes });
  }

  get(id: string) {
    return this.use(async () => {
      const entry = (await this.read(id)).entry;
      await this.catalog.markRead([id]);
      return { schema_version: KnowledgeFormat.Version, revision: this.revision, entry };
    });
  }

  history(input: unknown) {
    return this.use(async () => {
      const query = KnowledgeHistoryQuerySchema.parse(input);
      const current = (
        await readPersonaEntry(
          {
            read: (id) => this.read(id),
            readArchived: (id) => archivedPersona(this.root, id),
          },
          query.id,
        )
      ).entry;
      return KnowledgeHistoryPageSchema.parse({
        schema_version: KnowledgeFormat.Version,
        revision: this.revision,
        id: current.id,
        kind: current.kind,
        current_version: current.version,
        ...(await knowledgeHistory(this.root, current, this.settings, query)),
      });
    });
  }

  stats() {
    return this.use(async () => {
      const kinds = await this.catalog.kinds();
      const dates = await knowledgeDates(this.root, this.catalog.rows(), kinds);
      const ready = this.meaning
        ? (await this.meaning.ready()) && !(await this.catalog.embedderChanged(this.meaning.name))
        : false;
      return KnowledgeStatsSchema.parse({
        schema_version: KnowledgeFormat.Version,
        revision: this.revision,
        entries: sum(kinds, (row) => row.entries),
        bytes: sum(kinds, (row) => row.bytes),
        never_read: sum(kinds, (row) => row.never_read),
        ...dates,
        meaning_ready: ready,
      });
    });
  }

  add(input: unknown) {
    return this.use(async () => {
      const parsed = KnowledgeInputSchema.safeParse(input);
      if (!parsed.success || (parsed.data.version !== undefined && parsed.data.version !== 1))
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
      const entry = KnowledgeEntrySchema.parse({
        ...parsed.data,
        id: parsed.data.id ?? newId(),
        version: 1,
      });
      if (await this.catalog.get(entry.id))
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
      if (await archivedKnowledge(this.root, entry.id, this.settings.max_entry_bytes))
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
      await this.publish({ before: null, before_text: null, after: entry });
      return { schema_version: KnowledgeFormat.Version, revision: this.revision, entry };
    });
  }

  update(input: unknown) {
    return this.use(async () => {
      const parsed = KnowledgeUpdateSchema.safeParse(input);
      if (!parsed.success)
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
      const { entry: before, bytes } = await this.read(parsed.data.id);
      if (before.version !== parsed.data.version)
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
      if (before.kind !== parsed.data.entry.kind)
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
      const after = KnowledgeEntrySchema.parse({
        ...parsed.data.entry,
        id: before.id,
        version: before.version + 1,
      });
      await this.publish({ before, before_text: bytes.toString(FileEncoding.Utf8), after });
      return { schema_version: KnowledgeFormat.Version, revision: this.revision, entry: after };
    });
  }

  delete(input: unknown) {
    return this.use(async () => {
      const parsed = KnowledgeDeleteSchema.safeParse(input);
      if (!parsed.success)
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Invalid);
      const { entry: before, bytes } = await this.read(parsed.data.id);
      if (before.kind === KnowledgeKind.Persona)
        throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDeletion);
      if (before.version !== parsed.data.version)
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
      await this.publish({ before, before_text: bytes.toString(FileEncoding.Utf8), after: null });
      return {
        schema_version: KnowledgeFormat.Version,
        revision: this.revision,
        id: before.id,
        deleted_version: before.version,
      };
    });
  }

  maintenance(operation: KnowledgeCommand.Prune | KnowledgeCommand.Consolidate, input: unknown) {
    return this.use(async () => {
      const query = KnowledgeMaintenanceQuerySchema.parse(input);
      const plan = await maintenancePlan(
        this.root,
        this.catalog.rows(),
        (id) => this.read(id),
        (id) => this.catalog.neverRead(id),
        query,
      );
      if (!query.apply) return plan;
      if (operation === KnowledgeCommand.Consolidate) {
        for (const group of plan.groups)
          if (group.sources.length + 1 > KnowledgeLimit.PublicationEntries)
            throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
        for (const group of plan.groups) {
          const publication_id = newId();
          await this.commitPrepared({
            publication_id,
            mutations: [
              ...group.sources.map((source) => ({
                id: source.id,
                version: source.version,
                entry: null,
              })),
              { id: newId(), version: null, entry: group.entry },
            ],
          });
          plan.publications.push(publication_id);
        }
      } else {
        const candidates = plan.candidates.filter((candidate) => !candidate.retained);
        for (let index = 0; index < candidates.length; index += KnowledgeLimit.PublicationEntries) {
          const publication_id = newId();
          await this.commitPrepared({
            publication_id,
            mutations: candidates
              .slice(index, index + KnowledgeLimit.PublicationEntries)
              .map((candidate) => ({ id: candidate.id, version: candidate.version, entry: null })),
          });
          plan.publications.push(publication_id);
        }
      }
      plan.applied = true;
      return plan;
    });
  }

  restore(id: string) {
    return this.use(async () => {
      KnowledgeSelectionSchema.parse({ id });
      if (await this.catalog.get(id))
        throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Conflict);
      const retained = await archivedKnowledge(this.root, id, this.settings.max_entry_bytes);
      if (!retained) throw new TitanError(ErrorCode.KnowledgeMissing, KnowledgeMessage.Missing);
      if (retained.entry.kind === KnowledgeKind.Persona)
        throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDeletion);
      const after = KnowledgeEntrySchema.parse({
        ...retained.entry,
        version: retained.entry.version + 1,
      });
      await this.publish({
        before: retained.entry,
        before_text: retained.bytes.toString(FileEncoding.Utf8),
        after,
        restored: true,
      });
      return { schema_version: KnowledgeFormat.Version, revision: this.revision, entry: after };
    });
  }

  private async publish(change: KnowledgeChange): Promise<void> {
    assertPersonaDefinition(change);
    if (
      change.before?.kind === KnowledgeKind.Persona &&
      change.after &&
      personaHistory(change.before.body).state === PersonaState.Deleted &&
      !(await this.catalog.get(change.before.id))
    )
      change = { ...change, archived: true };
    const bytes = change.after ? knowledgeBytes(change.after, this.settings.max_entry_bytes) : null;
    if (bytes) assertNoSecrets(bytes);
    if (!change.archived) await this.catalog.admit(change);
    try {
      await recordKnowledgeChange(this.root, change);
      await this.observe?.(KnowledgePublicationStage.Journal);
      await publishKnowledgeFiles(this.root, change, this.settings, this.observe);
      if (!change.archived) await this.catalog.replace(change);
      this.revision = await this.catalog.project();
      await this.observe?.(KnowledgePublicationStage.Index);
      await removeKnowledgeFile(join(this.root, KnowledgeFile.Journal), this.root);
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }

  commit(input: unknown, beforeIntent?: AsyncTask<void>) {
    return this.use(() => this.commitPrepared(input, beforeIntent));
  }

  private async commitPrepared(input: unknown, beforeIntent?: AsyncTask<void>) {
    const prepared = await this.publisher.prepare(input);
    if (KnowledgeField.Publication in prepared) return prepared;
    await beforeIntent?.();
    try {
      const receipt = await this.publisher.publish(prepared, this.observe);
      this.revision = receipt.revision;
      return receipt;
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }

  registerPersonas(workflow: Workflow) {
    return this.use(() => this.personaRegistry().register(workflow));
  }

  resolvePersonas(workflow: Workflow) {
    return this.use(() => this.personaRegistry().resolve(workflow));
  }

  bindPersonas(workflow: Workflow, registration?: string) {
    return this.use(async () => {
      const registry = this.personaRegistry();
      const resolved = await registry.resolve(workflow);
      const references = await registry.register(workflow, registration);
      return { workflow: resolved, references };
    });
  }

  private personaRegistry(): PersonaRegistry {
    return new PersonaRegistry({
      read: (id) => this.read(id),
      readArchived: (id) => archivedPersona(this.root, id),
      publish: (change) => this.publish(change),
    });
  }

  openCall(tags: readonly string[], excluded: readonly string[] = []) {
    return this.use(() =>
      registeredOpenCall((id) => this.read(id), this.catalog.rows(), tags, excluded),
    );
  }

  personaDecision(
    request: OperationRequest,
    stage: PersonaDecisionStage = PersonaDecisionStage.Publish,
  ): Promise<void> {
    return this.use(() =>
      publishPersonaDecision(
        {
          read: (id) => this.read(id),
          readArchived: (id) => archivedPersona(this.root, id),
          publish: (change) => this.publish(change),
        },
        request,
        stage,
      ),
    );
  }

  async recordPersonaHistory(
    run: Run,
    events: AsyncIterable<RunEvent>,
    request?: PersonaRequestWriter,
    usage: readonly PersonaUsageReport[] = [],
  ): Promise<void> {
    if (!run.persona_references) return;
    for await (const event of events) {
      if (event.type !== RunEventKind.ResultJudged) continue;
      const { results } = PersonaJudgementSchema.parse(event.data);
      const requests = await this.recordPersonaResults(run, results);
      for (const pending of requests) await request?.(run, pending);
    }
    for (const report of usage)
      await this.use(async () => {
        if (
          report.run_id !== run.run_id ||
          report.through > run.version ||
          ![
            ...Object.values(run.persona_references ?? {}),
            ...Object.values(run.picks ?? {}),
          ].includes(report.persona)
        )
          throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
        await publishPersonaUsage(
          {
            read: (id) => this.read(id),
            readArchived: (id) => archivedPersona(this.root, id),
            publish: (change) => this.publish(change),
          },
          report,
        );
      });
    if (request && this.meaning)
      for (const offer of await this.use(() => this.meaning?.merges() ?? Promise.resolve([])))
        await request(run, offer);
  }

  private recordPersonaResults(
    run: Run,
    results: readonly PersonaQualityResult[],
  ): Promise<PersonaRequest[]> {
    return this.use(async () => {
      const requests: PersonaRequest[] = [];
      for (const result of results) {
        if (
          result.run !== run.run_id ||
          ![
            ...Object.values(run.persona_references ?? {}),
            ...Object.values(run.picks ?? {}),
          ].includes(result.persona)
        )
          throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
        requests.push(
          ...(await publishPersonaQuality(
            {
              read: (id) => this.read(id),
              readArchived: (id) => archivedPersona(this.root, id),
              publish: (change) => this.publish(change),
              rows: () => this.catalog.rows(),
              publishMany: async (publication_id, changes) => {
                await this.commitPrepared({
                  publication_id,
                  mutations: changes.map(changeMutation),
                });
              },
            },
            result,
          )),
        );
      }
      return requests;
    });
  }

  reindex() {
    return this.use(async () => {
      try {
        await this.catalog.rebuild();
        this.revision = await this.catalog.project();
        if (this.meaning) await this.catalog.recordEmbedder(this.meaning.name);
        return {
          schema_version: KnowledgeFormat.Version,
          revision: this.revision,
          ...(await this.catalog.usage()),
        };
      } catch (error) {
        this.failed = true;
        throw error;
      }
    });
  }

  searchAttempt(scope: KnowledgeAttemptScope, input: unknown) {
    return this.attempts.inspect(scope, async (document) => {
      this.scopedSearch ??= new KnowledgeAttemptSearch(this.root, this.catalog, this.settings);
      const searcher = this.scopedSearch;
      return this.use(() => searcher.page(input, document, this.revision));
    });
  }

  search(input: unknown) {
    return this.use(async () => {
      const parsed = KnowledgeSearchSchema.safeParse(input);
      if (!parsed.success)
        throw new TitanError(ErrorCode.KnowledgeInvalid, KnowledgeMessage.Search);
      const query = parsed.data;
      const wantsMeaning = query.mode !== KnowledgeSearchMode.Words && query.question;
      const changed =
        wantsMeaning && this.meaning
          ? await this.catalog.embedderChanged(this.meaning.name)
          : false;
      if (changed && query.mode === KnowledgeSearchMode.Meaning)
        throw new TitanError(ErrorCode.EmbedderChanged, KnowledgeMessage.EmbedderChanged);
      const hits =
        wantsMeaning && !changed
          ? ((await this.meaning?.hits(query.question, query.limit, query.all)) ?? null)
          : null;
      if (query.mode === KnowledgeSearchMode.Meaning && !hits)
        throw new TitanError(ErrorCode.NotBuilt, KnowledgeMessage.MeaningUnavailable);
      const words =
        query.mode === KnowledgeSearchMode.Meaning ? [] : await this.catalog.search(query);
      const blend = await blendMeaning(this.catalog, words, hits ?? [], query.kind, query.limit);
      const found = searchResults(this.root, blend.rows, blend.scores);
      if (query.question) await this.catalog.markRead(found.results.map((result) => result.id));
      const results = await all(
        found.results.map(
          (result) => async () =>
            result.kind === KnowledgeKind.Persona
              ? { ...result, persona: personaHistory((await this.read(result.id)).entry.body) }
              : result,
        ),
      );
      return {
        schema_version: KnowledgeFormat.Version,
        revision: this.revision,
        query,
        actual_mode: hits ? query.mode : KnowledgeSearchMode.Words,
        results,
        truncated: found.truncated,
        warning:
          query.mode === KnowledgeSearchMode.Both && !hits
            ? KnowledgeMessage.MeaningUnavailable
            : null,
      };
    });
  }
}

function sum<T>(rows: readonly T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

async function openMeaning(
  meaning: KnowledgeMeaning | undefined,
  resources: AsyncDisposableStack,
): Promise<KnowledgeMeaningRuntime | undefined> {
  if (!meaning) return undefined;
  try {
    const index = await meaning.open();
    resources.defer(() => index.close());
    return { embedder: meaning.embedder, index };
  } catch {
    return undefined;
  }
}

export async function ownKnowledge(home: string, resources: AsyncDisposableStack): Promise<void> {
  const path = join(home, KnowledgeFile.Lease);
  for (const suffix of KnowledgeFile.SqliteSidecars) await assertKnowledgeFile(path + suffix);
  const lease = new Bun.SQL({ adapter: ServerDatabaseAdapter, filename: path });
  resources.defer(() => lease.close());
  try {
    await lease.unsafe(KnowledgeSql.Initialize[0]);
    await lease.unsafe(KnowledgeSql.Claim);
    await chmod(path, ServerLimit.FileMode);
  } catch {
    throw new TitanError(ErrorCode.ServerLocked, KnowledgeMessage.Owner);
  }
}
