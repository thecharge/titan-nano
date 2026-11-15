import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import {
  BoardFile,
  ErrorCode,
  RunStatus,
  ServerLimit,
  ServerSql,
  ServerState,
  StepStatus,
  StoreEviction,
} from "@titan/constants";
import { all, hash } from "@titan/core";
import { errorMessage, TitanError } from "@titan/errors";
import { ServerMessage } from "@titan/messages";
import { summarizeUsage, UsageHistory } from "@titan/runner";
import { BoundedStore } from "@titan/store";
import {
  type CatalogDatabase,
  type DescribeCatalog,
  type ReadStoredRun,
  type Run,
  type RunEvent,
  type RunListQuery,
  type RunNumbers,
  RunNumbersSchema,
  RunPageSchema,
  type RunSummary,
  RunSummarySchema,
  type StoredCatalog,
  StoredCatalogSchema,
  StoredRunNumbersSchema,
  SummaryRowSchema,
  type SummaryStamp,
} from "@titan/types";
import { personaAction } from "@titan/workflow";
import { exists } from "@titan/workspace";
import { RunNumberHistory } from "./run-numbers.ts";

function summaryOf(run: Run, id: string, client: string): RunSummary {
  const step =
    run.state === RunStatus.Running
      ? run.plan.nodes.find((node) => run.nodes[node.id]?.state === StepStatus.Running)
      : undefined;
  return RunSummarySchema.parse({
    run_id: id,
    client_id: client,
    workflow_id: run.workflow_id,
    ...(run.harness_session_id !== undefined ? { harness_session_id: run.harness_session_id } : {}),
    state: run.state,
    ...(run.state === RunStatus.Running
      ? { stage: step?.id ?? null, persona: (step && personaAction(step.do)?.persona) ?? null }
      : {}),
    project: run.project,
  });
}

export function summaryStamp(root: string): SummaryStamp {
  const journal = Bun.file(resolve(root, BoardFile.Journal));
  return { size: journal.size, stamp: journal.lastModified };
}

async function persistSummary(
  db: CatalogDatabase,
  root: string,
  summary: RunSummary,
  journal: SummaryStamp = summaryStamp(root),
): Promise<void> {
  await db.unsafe(ServerSql.SummaryPut, [
    summary.run_id,
    journal.size,
    journal.stamp,
    JSON.stringify(summary),
  ]);
}

export async function writeRunSummary(
  db: CatalogDatabase,
  run: Run,
  stamp?: SummaryStamp,
): Promise<void> {
  const journal = stamp ?? summaryStamp(run.root);
  const store = new RunStore(run.root);
  const history = new RunNumberHistory(run);
  const usage = await summarizeUsage(run, numberEvents(store.events(run.version), history));
  const numbers = history.finish(usage);
  await persistNumbers(db, run, numbers, journal);
}

async function persistNumbers(
  db: CatalogDatabase,
  run: Run,
  numbers: RunNumbers,
  journal: SummaryStamp,
): Promise<void> {
  await db.unsafe(ServerSql.NumbersPut, [
    run.run_id,
    journal.size,
    journal.stamp,
    JSON.stringify(numbers),
  ]);
  await persistSummary(db, run.root, summaryOf(run, run.run_id, run.client_id), journal);
}

class SummaryHistory {
  private usage: UsageHistory;
  private numbers: RunNumberHistory;
  private through: number;
  private plan: string;
  private root: string;

  constructor(run: Run) {
    this.usage = new UsageHistory(run);
    this.numbers = new RunNumberHistory(run);
    this.through = run.version;
    this.plan = hash(JSON.stringify(run.plan));
    this.root = run.root;
  }

  accepts(run: Run, event: RunEvent): boolean {
    return (
      event.id === this.through + 1 &&
      event.id === run.version &&
      this.root === run.root &&
      this.plan === hash(JSON.stringify(run.plan)) &&
      this.usage.matches(run)
    );
  }

  observe(event: RunEvent): void {
    this.usage.observe(event);
    this.numbers.observe(event);
  }

  advance(event: RunEvent): void {
    this.usage.advance(event);
    this.numbers.observe(event);
    this.through = event.id;
  }

  finish(run: Run): RunNumbers {
    return this.numbers.finish(this.usage.finish(), run);
  }
}

export class RunSummaryProjector {
  private histories: BoundedStore<string, SummaryHistory>;

  constructor(
    private db: CatalogDatabase,
    maximum: number,
  ) {
    this.histories = new BoundedStore({
      maxEntries: maximum,
      eviction: StoreEviction.LeastRecentlyUsed,
    });
  }

  private async history(run: Run, event?: RunEvent): Promise<SummaryHistory> {
    const cached = this.histories.get(run.run_id);
    if (cached && event && cached.accepts(run, event)) {
      cached.advance(event);
      return cached;
    }
    const history = new SummaryHistory(run);
    for await (const entry of new RunStore(run.root).events(run.version)) history.observe(entry);
    this.histories.set(run.run_id, history);
    return history;
  }

  async write(run: Run, stamp?: SummaryStamp, event?: RunEvent): Promise<void> {
    try {
      const journal = stamp ?? summaryStamp(run.root);
      const history = await this.history(run, event);
      await persistNumbers(this.db, run, history.finish(run), journal);
    } catch (error) {
      this.histories.delete(run.run_id);
      throw error;
    }
  }
}

async function* numberEvents(
  events: AsyncIterable<RunEvent>,
  history: RunNumberHistory,
): AsyncGenerator<RunEvent> {
  for await (const event of events) {
    history.observe(event);
    yield event;
  }
}

export async function cachedRunNumbers(db: CatalogDatabase, summary: RunSummary, root: string) {
  const journal = summaryStamp(root);
  const parsed = StoredRunNumbersSchema.array().safeParse(
    await db.unsafe(ServerSql.NumbersGet, [summary.run_id]),
  );
  const stored = parsed.success ? parsed.data[0] : undefined;
  if (!stored || stored.size !== journal.size || stored.stamp !== journal.stamp) return null;
  try {
    const numbers = RunNumbersSchema.parse(JSON.parse(stored.numbers));
    return numbers.run_id === summary.run_id &&
      numbers.workflow_id === summary.workflow_id &&
      numbers.state === summary.state
      ? numbers
      : null;
  } catch {
    return null;
  }
}

export async function cachedRunSummary(
  db: CatalogDatabase,
  id: string,
  root: string,
): Promise<RunSummary | undefined> {
  const journal = Bun.file(resolve(root, BoardFile.Journal));
  const stored = SummaryRowSchema.array().parse(await db.unsafe(ServerSql.SummaryGet, [id]))[0];
  if (stored?.size !== journal.size || stored.stamp !== journal.lastModified) return undefined;
  const cached = RunSummarySchema.parse(JSON.parse(stored.summary));
  if (
    cached.run_id !== id ||
    (cached.state === RunStatus.Running &&
      (cached.stage === undefined || cached.persona === undefined))
  )
    return undefined;
  return cached;
}

export async function describeRun(
  row: StoredCatalog,
  read: ReadStoredRun,
  db?: CatalogDatabase,
  storedOnly = false,
): Promise<RunSummary> {
  try {
    const path = resolve(row.root, BoardFile.Journal);
    if (!(await exists(path)))
      return {
        run_id: row.id,
        client_id: row.client_id,
        state: ServerState.InitializationIncomplete,
        project: null,
      };
    const cached = db ? await cachedRunSummary(db, row.id, row.root) : undefined;
    if (cached) return cached;
    if (storedOnly) throw new TitanError(ErrorCode.RunNotFound, ServerMessage.SummaryUnavailable);
    const stamp = summaryStamp(row.root);
    const summary = summaryOf(await read(row), row.id, row.client_id);
    if (db) await persistSummary(db, row.root, summary, stamp);
    return summary;
  } catch (error) {
    return {
      run_id: row.id,
      client_id: row.client_id,
      state: ServerState.ReadUnavailable,
      project: null,
      error: errorMessage(error).slice(0, ServerLimit.SummaryCharacters),
    };
  }
}

export async function listRuns(
  db: CatalogDatabase,
  query: RunListQuery,
  describe: DescribeCatalog,
) {
  const rows = StoredCatalogSchema.array()
    .max(query.limit + 1)
    .parse(
      await db.unsafe(
        query.client_id === undefined ? ServerSql.List : ServerSql.ListClient,
        query.client_id === undefined
          ? [query.before, query.limit + 1]
          : [query.client_id, query.before, query.limit + 1],
      ),
    );
  const selected = rows.slice(0, query.limit);
  const summaries = await all(selected.map((row) => () => describe(row)));
  const runs = summaries.filter(
    (run) =>
      (query.harness_session_id === undefined ||
        run.harness_session_id === query.harness_session_id) &&
      (query.project_path === undefined || run.project === query.project_path),
  );
  return RunPageSchema.parse({
    schema_version:
      query.harness_session_id !== undefined || query.project_path !== undefined
        ? ServerLimit.FilteredRunPageVersion
        : ServerLimit.RunPageVersion,
    runs,
    before: query.before,
    next_before: selected.at(-1)?.sequence ?? query.before,
    has_more: rows.length > selected.length,
  });
}
