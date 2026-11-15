import { inspectArtifacts, readArtifact } from "@titan/artifacts";
import { describeRunConfiguration } from "@titan/config";
import {
  AttemptVerdict,
  DashboardField,
  DashboardLimit,
  DashboardProof,
  DashboardType,
  RunEventKind,
  ServerSql,
} from "@titan/constants";
import { DashboardMessage } from "@titan/messages";
import type { Engine } from "@titan/runner";
import type { KeyedQueue } from "@titan/store";
import {
  type CatalogDatabase,
  type DashboardAttemptRecord,
  type DashboardKnowledgeReader,
  type DashboardLoad,
  type DashboardSource,
  type DashboardStep,
  type EventPage,
  type ReadStoredRun,
  type Run,
  type RunEventView,
  RunListQuerySchema,
  StoredRootSchema,
} from "@titan/types";
import { personaAction } from "@titan/workflow";
import { cachedRunNumbers, describeRun, listRuns } from "./listing.ts";
import { eventStream, runNumbers } from "./run-numbers.ts";

const isString = (value: unknown): value is string => typeof value === DashboardType.String;
const isNumber = (value: unknown): value is number => typeof value === DashboardType.Number;

function field(data: unknown, name: string): unknown {
  return (Object(data) as Record<string, unknown>)[name];
}

function trackAttempts(events: RunEventView[]): Map<string, DashboardAttemptRecord[]> {
  const attempts = new Map<string, DashboardAttemptRecord[]>();
  for (const event of events) {
    const step = field(event.data, DashboardField.Step);
    if (!isString(step)) continue;
    const list = attempts.get(step) ?? [];
    attempts.set(step, list);
    const attempt = field(event.data, DashboardField.Attempt);
    if (event.type === RunEventKind.AttemptStarted && isNumber(attempt))
      list.push({ attempt, verdict: AttemptVerdict.Open });
    else if (event.type === RunEventKind.StepPassed && isNumber(attempt)) {
      const found = list.find((entry) => entry.attempt === attempt);
      if (found) found.verdict = AttemptVerdict.Survived;
    } else if (event.type === RunEventKind.ResultRefuted && isNumber(attempt)) {
      const found = list.find((entry) => entry.attempt === attempt - 1);
      if (found) found.verdict = AttemptVerdict.Refuted;
    } else if (event.type === RunEventKind.StepFailed) {
      const found = list.at(-1);
      if (found?.verdict === AttemptVerdict.Open) found.verdict = AttemptVerdict.Refuted;
    }
  }
  return attempts;
}

function stepViews(run: Run, events: RunEventView[]): DashboardStep[] {
  const attempts = trackAttempts(events);
  return run.plan.nodes.map((step) => {
    const node = run.nodes[step.id];
    const list = attempts.get(step.id) ?? [];
    const lastRefuted = list.findLast((entry) => entry.verdict === AttemptVerdict.Refuted);
    return {
      id: step.id,
      persona: personaAction(step.do)?.persona ?? null,
      state: node?.state ?? DashboardField.Pending,
      needs: step.needs ?? [],
      recovery: Object.entries(node?.phases ?? {})
        .filter(([, phase]) => !phase.completed)
        .map(([phase, checkpoint]) => ({
          phase,
          executions: checkpoint.executions,
          retries: checkpoint.retries,
          next_retry: checkpoint.next_retry,
          capture_pending: checkpoint.capture_pending === true,
          error: checkpoint.error,
        })),
      attempts: list.map((entry) => ({
        attempt: entry.attempt,
        verdict: entry.verdict,
        evidence: entry === lastRefuted ? [...(node?.evidence ?? [])] : [],
      })),
      checks: events
        .filter(
          (event) =>
            event.type === DashboardProof.EventType &&
            field(event.data, DashboardField.Step) === step.id,
        )
        .map((event) => ({
          phase: String(field(event.data, DashboardField.Phase) ?? DashboardField.Empty),
          answer: String(field(event.data, DashboardField.Answer)),
        })),
    };
  });
}

export function dashboardSource(
  database: CatalogDatabase,
  engine: Engine,
  operations: KeyedQueue,
  load: DashboardLoad,
  readStoredRun: ReadStoredRun,
  knowledge?: DashboardKnowledgeReader,
): DashboardSource {
  const readPage = (id: string, after: number): Promise<EventPage> => engine.events(id, { after });
  async function all(id: string): Promise<RunEventView[]> {
    const events: RunEventView[] = [];
    for await (const event of eventStream((after) => readPage(id, after))) events.push(event);
    return events;
  }
  async function numbers(id: string) {
    await load(id);
    const run = await engine.snapshot(id);
    return runNumbers(
      run,
      await engine.usage(id),
      eventStream((after) => readPage(id, after)),
    );
  }
  return {
    configuration(id) {
      return operations.use(id, async () => {
        await load(id);
        return describeRunConfiguration(await engine.snapshot(id));
      });
    },
    artifacts(id) {
      return operations.use(id, async () => {
        await load(id);
        return inspectArtifacts(await engine.snapshot(id));
      });
    },
    artifact(id, file, query) {
      return operations.use(id, async () => {
        await load(id);
        return readArtifact(await engine.snapshot(id), file, query);
      });
    },
    ...(knowledge ? { knowledge } : {}),
    async list(query = {}) {
      const page = await listRuns(
        database,
        RunListQuerySchema.parse({ ...query, limit: query.limit ?? DashboardLimit.RunPageSize }),
        (row) => operations.use(row.id, () => describeRun(row, readStoredRun, database, true)),
      );
      const runs = [];
      for (const summary of page.runs) {
        const stored = StoredRootSchema.optional().parse(
          (await database.unsafe(ServerSql.Root, [summary.run_id]))[0],
        );
        const numbers = stored ? await cachedRunNumbers(database, summary, stored.root) : null;
        runs.push({
          summary,
          stage: summary.stage ?? null,
          persona: summary.persona ?? null,
          numbers,
        });
      }
      const { runs: _summaries, ...pagination } = page;
      return { runs, page: pagination, capacity: engine.agentCapacity() };
    },
    run(id) {
      return operations.use(id, async () => {
        await load(id);
        const run = await engine.snapshot(id);
        const events = await all(id);
        const requests = (await engine.requests.list(id)).filter(
          (request) => request.answer === null,
        );
        return {
          context: {
            backend: run.switched_backend ?? run.backend,
            runtime_version: run.runtime_version ?? null,
            project: run.project,
            max_parallel: run.config.value.limits.max_parallel,
            error: run.error,
            artifacts: run.artifacts,
          },
          numbers: await numbers(id),
          steps: stepViews(run, events),
          board: events.slice(-DashboardLimit.ListedBoardMessages),
          requests: requests.map((request) => ({
            request_id: request.request_id,
            kind: request.kind,
            answer_command: DashboardMessage.AnswerCommand(id, request.request_id, request.version),
          })),
          answer_hint: DashboardMessage.AnswerHint,
        };
      });
    },
    events(id, after) {
      return operations.use(id, async () => {
        await load(id);
        return readPage(id, after);
      });
    },
  };
}
