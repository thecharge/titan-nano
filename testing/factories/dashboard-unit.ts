import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initialPhase } from "@titan/board";
import { Backend, BoardLimit, DashboardLiveFixture } from "@titan/constants";
import type { Engine } from "@titan/runner";
import { buildDashboardAssets, Dashboard, rewriteSources } from "@titan/server/dashboard";
import { DashboardSessions, sessionFrom } from "@titan/server/dashboard-session";
import { dashboardSource } from "@titan/server/dashboard-source";
import { eventBody } from "@titan/server/event-stream";
import { eventStream } from "@titan/server/run-numbers";
import type { KeyedQueue } from "@titan/store";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type {
  ArtifactInspection,
  ArtifactPage,
  CatalogDatabase,
  DashboardSource,
  EventPage,
  Phase,
  ReadStoredRun,
  RunConfiguration,
} from "@titan/types";

export async function dashboardConfigurationQuery(
  query: string,
  authenticated: boolean,
  supported: boolean,
) {
  const sessions = new DashboardSessions();
  const session = sessions.consume(sessions.mint());
  let received: string | null = null;
  const source: DashboardSource = {
    configuration: async (id) => {
      received = id;
      return {} as RunConfiguration;
    },
    list: async () => ({ runs: [] }),
    run: async () => {
      throw new Error("unexpected run read");
    },
    events: async () => {
      throw new Error("unexpected event read");
    },
  };
  if (!supported) delete source.configuration;
  const path = `/ui/api/runs/run%20one/config${query}`;
  const dashboard = new Dashboard(source, sessions);
  const response = await dashboard.respond(
    new Request(`http://localhost${path}`, {
      headers: authenticated ? { cookie: `titan_session=${session}` } : {},
    }),
    "http://localhost",
  );
  return {
    handled: dashboard.handles(new URL(`http://localhost${path}`).pathname),
    status: response.status,
    received,
  };
}

export async function dashboardArtifactQuery(
  query: string,
  file: boolean,
  authenticated: boolean,
  supported = true,
) {
  const sessions = new DashboardSessions();
  const session = sessions.consume(sessions.mint());
  let received: unknown = null;
  const source: DashboardSource = {
    artifacts: async (id) => {
      received = { id };
      return {} as ArtifactInspection;
    },
    artifact: async (id, path, range) => {
      received = { id, file: path, range };
      return {} as ArtifactPage;
    },
    list: async () => ({ runs: [] }),
    run: async () => {
      throw new Error("unexpected run read");
    },
    events: async () => {
      throw new Error("unexpected event read");
    },
  };
  if (!supported) {
    delete source.artifact;
    delete source.artifacts;
  }
  const path = `/ui/api/runs/run%20one/artifacts${file ? `/${"a".repeat(64)}` : ""}${query}`;
  const dashboard = new Dashboard(source, sessions);
  const response = await dashboard.respond(
    new Request(`http://localhost${path}`, {
      headers: authenticated ? { cookie: `titan_session=${session}` } : {},
    }),
    "http://localhost",
  );
  return {
    handled: dashboard.handles(new URL(`http://localhost${path}`).pathname),
    status: response.status,
    received,
  };
}

export async function packedDashboardAssets(contents: string) {
  return withTemporaryDirectory(async (directory) => {
    await mkdir(resolve(directory, "assets"));
    await writeFile(resolve(directory, "assets/dashboard.json"), contents);
    const assets = await buildDashboardAssets(directory);
    return {
      paths: [...assets.keys()],
      page: assets.get("/")?.body,
      script: assets.get("/app.js")?.body,
    };
  });
}

export async function dashboardListQuery(query: string) {
  const sessions = new DashboardSessions();
  const session = sessions.consume(sessions.mint());
  let received: unknown = null;
  const source = {
    list: async (input) => {
      received = input;
      return { runs: [] };
    },
    run: async () => {
      throw new Error("unexpected run read");
    },
    events: async () => {
      throw new Error("unexpected event read");
    },
  } satisfies DashboardSource;
  const response = await new Dashboard(source, sessions).respond(
    new Request(`http://localhost/ui/api/runs${query}`, {
      headers: { cookie: `titan_session=${session}` },
    }),
    "http://localhost",
  );
  return { status: response.status, query: received };
}

export function codeOutcome(advance: number, tries: number, supplied?: string | null): string {
  let now = 0;
  const sessions = new DashboardSessions(() => now);
  const code = sessions.mint();
  now += advance;
  let outcome: string | undefined;
  for (let attempt = 0; attempt < tries; attempt++)
    outcome = sessions.consume(supplied === undefined ? code : supplied);
  return outcome !== undefined && sessions.valid(outcome) ? "session" : "refused";
}

export function mintedCodes(count: number): number {
  const sessions = new DashboardSessions(() => 0);
  const codes = new Set<string>();
  for (let index = 0; index < count; index++) codes.add(sessions.mint());
  return codes.size;
}

export function sessionValid(probe: string | undefined, others: number): boolean {
  const sessions = new DashboardSessions(() => 0);
  for (let index = 0; index < others; index++) sessions.consume(sessions.mint());
  const issued = sessions.consume(sessions.mint());
  return sessions.valid(probe === "issued" ? issued : probe);
}

export function sessionRetention(count: number, index: number): boolean {
  const sessions = new DashboardSessions(() => 0);
  const issued = Array.from({ length: count }, () => sessions.consume(sessions.mint()));
  return sessions.valid(issued[index]);
}

export async function dashboardFallback(path: string) {
  const sessions = new DashboardSessions();
  const session = sessions.consume(sessions.mint());
  const source: DashboardSource = {
    list: async () => ({ runs: [] }),
    run: async () => {
      throw new Error("Injected dashboard source failure");
    },
    events: async () => {
      throw new Error("Unexpected dashboard events");
    },
  };
  const response = await new Dashboard(source, sessions).respond(
    new Request(`http://localhost${path}`, { headers: { cookie: `titan_session=${session}` } }),
    "http://localhost",
  );
  return response.status;
}

export function cookieSession(header: string | null): string {
  return sessionFrom(header) ?? "none";
}

export function rewrittenSources(html: string, names: string[]): string {
  return rewriteSources(html, new Set(names));
}

function page(after: number, ids: number[], more: boolean): EventPage {
  return {
    schema_version: BoardLimit.EventPageVersion,
    run_id: "run",
    after,
    events: ids.map((id) => ({ id, time: id, type: "event", data: null })),
    next_cursor: ids.at(-1) ?? after,
    has_more: more,
  };
}

export async function streamedIds(pages: number[][], fail: boolean): Promise<string> {
  const ids: number[] = [];
  const read = async (after: number): Promise<EventPage> => {
    const index = pages.findIndex((entry) => (entry[0] ?? 0) === after + 1);
    if (fail && index > 0) throw new Error("read failed");
    const current = pages[Math.max(index, 0)] ?? [];
    return page(after, current, index < pages.length - 1);
  };
  for await (const event of eventStream(read)) ids.push(event.id);
  return ids.join(",");
}

async function viewOf(
  events: [string, unknown][],
  requestCount: number,
  stepId: string,
  evidence: string[],
  phases: Record<string, Phase> = {},
  needs: string[] = [],
) {
  const run = {
    run_id: "run",
    workflow_id: "flow",
    state: "passed",
    created_at: 1,
    backend: Backend.Codex,
    project: "/project",
    config: { value: { limits: { max_parallel: 2 } } },
    error: null,
    artifacts: null,
    plan: { nodes: [{ id: stepId, do: { persona: "builder" }, needs }] },
    nodes: { [stepId]: { state: "passed", evidence, phases } },
  };
  const usage = {
    known: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    complete: { input_tokens: false, output_tokens: false, cost_usd: false },
    reported_executions: 0,
    unreported_executions: 0,
  };
  const engine = {
    snapshot: async () => run,
    usage: async () => usage,
    events: async (): Promise<EventPage> => ({
      ...page(0, [], false),
      events: events.map(([type, data], index) => ({ id: index + 1, time: index, type, data })),
    }),
    requests: {
      list: async () =>
        Array.from({ length: requestCount }, (_, index) => ({
          request_id: `request-${index}`,
          kind: "approval",
          version: 1,
          answer: null,
        })),
    },
  };
  const queue = { use: (_id: string, task: () => Promise<unknown>) => task() };
  const source = dashboardSource(
    {} as CatalogDatabase,
    engine as unknown as Engine,
    queue as unknown as KeyedQueue,
    async () => undefined,
    {} as unknown as ReadStoredRun,
  );
  return source.run("run");
}

export async function dashboardRunDetails(
  needs: string[],
  pending: boolean,
  completed: boolean,
  error: string | null,
) {
  const phase = {
    ...initialPhase(),
    executions: 2,
    retries: 1,
    completed,
    error,
    next_retry: 1000,
    ...(pending ? { capture_pending: true as const } : {}),
  };
  const view = await viewOf([], 0, "build", [], { worker: phase }, needs);
  return { context: view.context, needs: view.steps[0]?.needs, recovery: view.steps[0]?.recovery };
}

export async function provedStep(
  events: [string, unknown][],
  stepId: string,
  evidence: string[],
): Promise<string> {
  const step = (await viewOf(events, 0, stepId, evidence)).steps[0];
  return [
    step?.id,
    ...(step?.attempts ?? []).map(
      (entry) => `${entry.attempt}:${entry.verdict}:${entry.evidence.join(",")}`,
    ),
    ...(step?.checks ?? []).map((check) => `${check.phase}=${check.answer}`),
  ].join(" ");
}

export async function liveFrames(
  initial: number[],
  after: number,
  published: number[],
): Promise<string> {
  const log = [...initial];
  const read = async (cursor: number): Promise<EventPage> => {
    const ids = log.filter((id) => id > cursor);
    return page(cursor, ids, false);
  };
  const body = eventBody(read, after);
  const reader = body.getReader();
  const started = performance.now();
  setTimeout(() => log.push(...published), DashboardLiveFixture.PublishDelayMilliseconds);
  const chunk = await Promise.race([
    reader.read(),
    Bun.sleep(
      published.length
        ? DashboardLiveFixture.ArrivalLimitMilliseconds
        : DashboardLiveFixture.SilenceMilliseconds,
    ).then(() => undefined),
  ]);
  const elapsed = performance.now() - started;
  await reader.cancel();
  if (chunk === undefined) return "none";
  const text = new TextDecoder().decode(chunk.value);
  const id = DashboardLiveFixture.FramePattern.exec(text)?.[1] ?? "none";
  return `${id} ${elapsed < DashboardLiveFixture.ArrivalLimitMilliseconds}`;
}

export async function keepAliveFrame(idleMilliseconds: number): Promise<string> {
  const real = Date.now;
  const start = real();
  let calls = 0;
  Date.now = () => (calls++ === 0 ? start : start + idleMilliseconds);
  const reader = eventBody(async (cursor) => page(cursor, [], false), 0).getReader();
  const chunk = await Promise.race([
    reader.read(),
    Bun.sleep(DashboardLiveFixture.SilenceMilliseconds).then(() => undefined),
  ]);
  Date.now = real;
  await reader.cancel();
  return chunk === undefined ? "none" : new TextDecoder().decode(chunk.value).trim();
}

export async function stepReport(
  events: [string, unknown][],
  requestCount: number,
): Promise<string> {
  const view = await viewOf(events, requestCount, "build", ["refuting evidence"]);
  const step = view.steps[0];
  return [
    step?.attempts
      .map((entry) => `${entry.attempt}:${entry.verdict}:${entry.evidence.length}`)
      .join(" "),
    step?.checks.map((check) => `${check.phase}=${check.answer}`).join(" "),
    view.requests.map((request) => request.answer_command).join(" "),
  ].join(" | ");
}
