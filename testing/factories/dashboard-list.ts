import { expect } from "bun:test";
import { resolve } from "node:path";
import {
  BoardFile,
  DashboardListFailure,
  DashboardListFixture,
  RunStatus,
  ServerSql,
  StepStatus,
  WorkflowField,
} from "@titan/constants";
import { Capacity, type Engine } from "@titan/runner";
import { dashboardSource } from "@titan/server/dashboard-source";
import { describeRun } from "@titan/server/listing";
import type { KeyedQueue } from "@titan/store";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { CatalogDatabase, ReadStoredRun, StoredCatalog } from "@titan/types";

function runOf(index: number, running: number, scripted: boolean) {
  const id = DashboardListFixture.StepPrefix + index;
  const working = index < running;
  return {
    workflow_id: DashboardListFixture.Flow,
    state: working ? RunStatus.Running : RunStatus.Passed,
    project: DashboardListFixture.Project,
    plan: {
      nodes: [
        { id, do: scripted ? {} : { [WorkflowField.Persona]: DashboardListFixture.Persona } },
      ],
    },
    nodes: { [id]: { state: working ? StepStatus.Running : StepStatus.Passed } },
  };
}

export async function listedRuns(
  total: number,
  running: number,
  scripted: boolean,
  cached = false,
  before?: number,
  limit?: number,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    await Bun.write(resolve(root, BoardFile.Journal), DashboardListFixture.Journal);
    const runs = new Map<string, ReturnType<typeof runOf>>();
    const rows: StoredCatalog[] = [];
    for (let index = 0; index < total; index++) {
      const id = DashboardListFixture.RunPrefix + index;
      runs.set(id, runOf(index, running, scripted));
      rows.push({ sequence: index + 1, id, root, client_id: DashboardListFixture.Client });
    }
    const summaries = new Map<string, unknown>();
    let snapshots = 0;
    let storedReads = 0;
    const database = {
      unsafe: async (query: string, params: unknown[]) => {
        if (query === ServerSql.SummaryGet)
          return summaries.has(String(params[0])) ? [summaries.get(String(params[0]))] : [];
        if (query === ServerSql.SummaryPut) {
          summaries.set(String(params[0]), {
            size: params[1],
            stamp: params[2],
            summary: params[3],
          });
          return [];
        }
        return rows
          .filter((row) => row.sequence < Number(params[0] ?? 0))
          .sort((left, right) => right.sequence - left.sequence)
          .slice(0, Number(params[1]));
      },
    };
    let reads = 0;
    const engine = {
      agentCapacity: () => new Capacity(2).snapshot(),
      snapshot: async (id: string) => {
        snapshots++;
        return runs.get(id);
      },
      events: async () => {
        reads++;
        throw new Error(DashboardListFailure.EventsRead);
      },
      usage: async () => {
        reads++;
        throw new Error(DashboardListFailure.UsageRead);
      },
    };
    const queue = { use: (_id: string, task: () => Promise<unknown>) => task() };
    const source = dashboardSource(
      database as unknown as CatalogDatabase,
      engine as unknown as Engine,
      queue as unknown as KeyedQueue,
      async () => undefined,
      (async (row: StoredCatalog) => {
        storedReads++;
        return runs.get(row.id);
      }) as unknown as ReadStoredRun,
    );
    for (const row of rows)
      await describeRun(
        row,
        (async () => runs.get(row.id)) as unknown as ReadStoredRun,
        database as unknown as CatalogDatabase,
      );
    if (cached) {
      await source.list();
      expect(storedReads).toBe(0);
    }
    const priorReads = storedReads;
    const started = performance.now();
    const page = await source.list({ before, limit });
    const listed = page.runs;
    const expected = rows
      .filter((row) => row.sequence < (before ?? Number.MAX_SAFE_INTEGER))
      .reverse();
    expect(listed.map((entry) => entry.summary.run_id)).toEqual(
      expected.slice(0, limit ?? 200).map((entry) => entry.id),
    );
    expect(page.page?.next_before).toBe(
      expected.slice(0, limit ?? 200).at(-1)?.sequence ?? before ?? Number.MAX_SAFE_INTEGER,
    );
    expect(page.page?.has_more).toBe(expected.length > (limit ?? 200));
    const elapsed = performance.now() - started;
    expect(snapshots).toBe(0);
    if (cached) expect(storedReads).toBe(priorReads);
    return [
      listed.length,
      listed.filter((entry) => entry.summary.state === RunStatus.Running).length,
      listed.filter((entry) => entry.stage !== null).length,
      listed.filter((entry) => entry.persona !== null).length,
      reads,
      elapsed < DashboardListFixture.LimitMilliseconds,
    ].join(DashboardListFixture.Separator);
  });
}
