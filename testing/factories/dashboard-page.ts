import { expect } from "bun:test";
import { strict as assert } from "node:assert";
import { Backend, DashboardPageExercise, DashboardRoute } from "@titan/constants";
import { waitUntil } from "@titan/test-framework";
import type {
  ArtifactInspection,
  ArtifactPage,
  CapacitySnapshot,
  DashboardRun,
  DashboardRunPagination,
  RunConfiguration,
} from "@titan/types";
import { ConfigSchema } from "@titan/types";

class FakeNode {
  children: FakeNode[] = [];
  textContent = "";
  href = "";
  name = "";
  value = "";
  parent: FakeNode | undefined;
  listeners = new Map<string, (event: Event) => void>();
  constructor(readonly tag: string) {}
  append(...nodes: FakeNode[]): void {
    for (const node of nodes) node.parent = this;
    this.children.push(...nodes);
  }
  replaceChildren(...nodes: FakeNode[]): void {
    this.children = nodes;
  }
  addEventListener(name: string, listener: (event: Event) => void): void {
    this.listeners.set(name, listener);
  }
  contains(node: FakeNode | null | undefined): boolean {
    return this === node || this.children.some((child) => child.contains(node));
  }
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this);
  }
  get firstElementChild(): FakeNode | undefined {
    return this.children[0];
  }
}

class FakeSource {
  static made: FakeSource[] = [];
  listener: ((message: MessageEvent<string>) => void) | undefined;
  listeners = new Map<string, (message: MessageEvent<string>) => void>();
  closed = false;
  constructor(readonly url: string) {
    FakeSource.made.push(this);
  }
  addEventListener(_name: string, listener: (message: MessageEvent<string>) => void): void {
    this.listeners.set(_name, listener);
    if (_name === "run-event") this.listener = listener;
  }
  close(): void {
    this.closed = true;
  }
}

const measure = { state: "complete", value: 5, missing: 0, label: "complete" };
const unreported = { state: "not_reported", value: null, missing: 1, label: "not reported" };
const numbers = {
  run_id: "run-1",
  workflow_id: "flow",
  state: "passed",
  started_at: 1,
  elapsed: 2,
  attempts: 3,
  most_agents_at_once: 1,
  input_tokens: measure,
  output_tokens: measure,
  cost_usd: unreported,
  survived: 1,
  refuted: 1,
  proofs: { proven: 1, refuted: 0, not_proven: 0 },
};
const list = {
  runs: [
    {
      summary: { run_id: "run-1", workflow_id: "flow", state: "passed" },
      stage: "build",
      persona: "builder",
      numbers,
    },
    {
      summary: { run_id: "run-2", workflow_id: null, state: "queued" },
      stage: null,
      persona: null,
      numbers: null,
    },
  ],
};
const board = [
  { id: 1, time: 1, type: "attempt_started", data: { step_id: "build" } },
  { id: 2, time: 2, type: "step_passed", data: { step_id: "build" } },
];
const run = {
  numbers,
  steps: [
    {
      id: "build",
      persona: null,
      state: "passed",
      attempts: [{ attempt: 1, verdict: "refuted", evidence: ["evidence text"] }],
      checks: [{ phase: "tests", answer: "proven" }],
    },
  ],
  board,
  requests: [{ request_id: "request-1", kind: "approval", answer_command: "titan answer run" }],
  answer_hint: "answer in a terminal",
};
const empty = { ...run, board: [], requests: [] };

const knowledgeEntry = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "fact",
  title: "Clock safety",
  version: 2,
  scope: "project",
  state: "final",
  tags: ["clock"],
};
const knowledge = {
  list: { entries: [knowledgeEntry], truncated: false },
  stats: {
    meaning_ready: false,
    scopes: [
      {
        scope: "project",
        entries: 1,
        bytes: 200,
        never_read: 1,
        oldest: { updated: "2026-11-13T00:00:00Z" },
        newest: { updated: "2026-11-13T00:00:00Z" },
        kinds: [
          {
            kind: "fact",
            entries: 1,
            bytes: 200,
            never_read: 1,
            oldest: { updated: "2026-11-10T00:00:00Z" },
            newest: { updated: "2026-11-12T00:00:00Z" },
          },
        ],
      },
    ],
  },
  entry: {
    ...knowledgeEntry,
    entry: { ...knowledgeEntry, body: "<script>untrusted text</script>" },
    history: {
      earlier_versions: 1,
      promoted_from: "home",
      page: {
        entries: [
          {
            ...knowledgeEntry,
            version: 1,
            body: "<img src=x onerror=alert(1)>Earlier retained body",
          },
        ],
        next_before: 1,
      },
    },
    links: [{ ...knowledgeEntry, relation: "mentions" }],
  },
};

const root = new FakeNode("div");
const listeners: (() => void)[] = [];
let loaded = false;

function textOf(node: FakeNode): string[] {
  return [node.textContent, ...node.children.flatMap(textOf)].filter((text) => text !== "");
}

function linksOf(node: FakeNode): string[] {
  return [node.href, ...node.children.flatMap(linksOf)].filter((href) => href !== "");
}

export async function renderedPage(
  hash: string,
  streamed: number[],
  emptyBoard = false,
  status = 200,
  malformed = false,
  exercise = DashboardPageExercise.None,
  pagination?: DashboardRunPagination,
  inspection?: Partial<DashboardRun>,
  capacity?: CapacitySnapshot,
  artifact?: Partial<ArtifactInspection> | Partial<ArtifactPage>,
  configuration?: RunConfiguration,
): Promise<string> {
  const timers: (() => void)[] = [];
  const pending = Promise.withResolvers<void>();
  const delayed = [
    DashboardPageExercise.DelayedRun,
    DashboardPageExercise.DelayedList,
    DashboardPageExercise.DelayedKnowledge,
    DashboardPageExercise.DelayedFailure,
  ].some((value) => value === exercise);
  let calls = 0;
  FakeSource.made = [];
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = [
    "document",
    "window",
    "location",
    "EventSource",
    "fetch",
    "setInterval",
    "clearInterval",
  ].map((name) => [name, globals[name]] as const);
  globals.document = {
    getElementById: () => root,
    createElement: (tag: string) => new FakeNode(tag),
  };
  globals.window = {
    addEventListener: (_name: string, listener: () => void) => listeners.push(listener),
  };
  globals.location = { hash };
  globals.EventSource = FakeSource;
  globals.setInterval = (callback: () => void) => timers.push(callback);
  globals.clearInterval = () => timers.splice(0);
  globals.fetch = async (path: string) => {
    const response = new Response(
      malformed
        ? "invalid JSON"
        : JSON.stringify(
            path.endsWith(DashboardRoute.ConfigurationSuffix)
              ? configuration
              : path.includes(DashboardRoute.ArtifactsSuffix)
                ? artifact
                : path.startsWith(DashboardRoute.Knowledge)
                  ? {
                      ...knowledge,
                      list: path.includes("state=pending")
                        ? {
                            entries: [
                              {
                                ...knowledgeEntry,
                                state: "pending",
                                operation: "update",
                                attempt: {
                                  run_id: "run-1",
                                  step_id: "build",
                                  candidate_id: "candidate-1",
                                  part_id: null,
                                  attempt: 2,
                                },
                              },
                            ],
                            truncated: false,
                          }
                        : emptyBoard
                          ? { entries: [], truncated: true }
                          : knowledge.list,
                      stats: { ...knowledge.stats, meaning_ready: emptyBoard },
                      entry: new URL(path, "http://localhost").searchParams.has("id")
                        ? knowledge.entry
                        : null,
                    }
                  : path.split("?")[0] === DashboardRoute.Runs
                    ? exercise === DashboardPageExercise.EmptyRuns
                      ? { runs: [], page: pagination }
                      : { ...list, page: pagination, capacity }
                    : emptyBoard
                      ? empty
                      : exercise === DashboardPageExercise.EmptySteps
                        ? { ...run, steps: [] }
                        : { ...run, ...inspection },
          ),
      { status },
    );
    if (delayed && calls++ === 0) {
      await pending.promise;
      if (exercise === DashboardPageExercise.DelayedFailure) throw new Error("stale failure");
    }
    if (exercise === DashboardPageExercise.FocusedFilters && calls++ === 1) await pending.promise;
    return response;
  };
  try {
    const first = root.children[0];
    if (loaded) listeners[0]?.();
    else await import("../../packages/server/src/dashboard/app.ts");
    loaded = true;
    if (delayed) await redirectPending(exercise, pending.resolve);
    await waitUntil(
      async () =>
        root.children[0] !== first &&
        !textOf(root).includes("Loading…") &&
        (root.children.some((node) => node.tag === "button") ||
          timers.length > 0 ||
          FakeSource.made.length > 0 ||
          globalThis.location.hash.startsWith("#/knowledge/") ||
          globalThis.location.hash.startsWith("#/artifacts/") ||
          globalThis.location.hash.startsWith("#/config/")),
    );
    for (const id of streamed)
      FakeSource.made[0]?.listener?.(
        new MessageEvent("x", { data: JSON.stringify({ id, time: id, type: "x", data: null }) }),
      );
    if (exercise === DashboardPageExercise.Retry) status = 200;
    if (exercise === DashboardPageExercise.RefreshFailure) status = 500;
    await exercisePage(exercise, timers, pending.resolve);
    const shown = [
      root.children.length,
      textOf(root).join("|"),
      FakeSource.made[0]?.url ?? "no stream",
    ].join(" ");
    const rendered = root.children[0];
    for (const timer of timers) timer();
    if (timers.length > 0) await waitUntil(async () => root.children[0] !== rendered);
    return shown;
  } finally {
    for (const [name, value] of saved) globals[name] = value;
  }
}

export async function renderedConfiguration(status: number, emptySources: boolean) {
  const settings = ConfigSchema.parse({ limits: { max_parallel: 7 } });
  const literal = "<script>owner settings</script>";
  const configuration = {
    schema_version: 1 as const,
    run_id: "run-1",
    workflow_id: "workflow",
    workflow_revision: "a".repeat(64),
    through: 2,
    config: {
      value: settings,
      hash: "b".repeat(64),
      sources: emptySources ? {} : { "limits.max_parallel": [literal] },
    },
  };
  const shown = await renderedPage(
    "#/config/run-1",
    [],
    false,
    status,
    false,
    DashboardPageExercise.None,
    undefined,
    undefined,
    undefined,
    undefined,
    configuration,
  );
  assert.equal(FakeSource.made.length, 0);
  if (status !== 200) {
    assert.equal(shown.includes("Try again"), true);
    assert.equal(shown.includes(configuration.config.hash), false);
    return true;
  }
  assert.ok(shown.includes("Frozen settings"));
  assert.ok(shown.includes(configuration.config.hash));
  assert.equal(shown.includes(literal), !emptySources);
  assert.ok(shown.includes('"max_parallel": 7'));
  assert.ok(linksOf(root).includes("#/run/run-1"));
  return true;
}

export async function renderedArtifact(file: boolean, empty: boolean) {
  const id = "a".repeat(64);
  const path = "<img src=x onerror=alert(1)>";
  const metadata = { id, path, bytes: 10, executable: false, hash: id };
  const artifact = file
    ? {
        file: metadata,
        offset: empty ? 4 : 0,
        next_offset: empty ? 5 : 10,
        has_more: empty,
        content: Buffer.from(empty ? [255] : "<script>literal</script>").toString("base64"),
      }
    : { hash: id, files: empty ? [] : [metadata], outputs: { build: "<b>literal</b>" } };
  const shown = await renderedPage(
    `#/artifacts/run-1${file ? `/${id}` : ""}`,
    [],
    false,
    200,
    false,
    DashboardPageExercise.None,
    undefined,
    undefined,
    undefined,
    artifact,
  );
  return {
    empty: shown.includes("This delivery contains no files"),
    literal: shown.includes(
      file ? (empty ? "/w==" : "<script>literal</script>") : "<b>literal</b>",
    ),
    binary: shown.includes("Binary content shown as base64"),
    next: linksOf(root).some((link) => link.endsWith("?offset=5")),
    first: linksOf(root).some((link) => link.endsWith("?offset=0")),
    fileLink: linksOf(root).includes(`#/artifacts/run-1/${id}`),
    stream: FakeSource.made.length,
  };
}

export async function renderedCapacity(capacity: CapacitySnapshot) {
  const shown = await renderedPage(
    "#/",
    [],
    false,
    200,
    false,
    DashboardPageExercise.None,
    undefined,
    undefined,
    capacity,
  );
  return shown.split("|Agent capacity|")[1]?.split("|Recent runs")[0];
}

export async function renderedRunDetails(pending: boolean, error: string | null, legacy: boolean) {
  const shown = await renderedPage(
    "#/run/run-1",
    [],
    false,
    200,
    false,
    DashboardPageExercise.None,
    undefined,
    legacy
      ? undefined
      : {
          context: {
            backend: Backend.Codex,
            runtime_version: null,
            project: "/shared/project",
            max_parallel: 2,
            error,
            artifacts: null,
          },
          steps: [
            {
              ...run.steps[0],
              id: "build",
              persona: null,
              state: "blocked",
              attempts: [],
              checks: [],
              needs: ["research", "design"],
              recovery: [
                {
                  phase: "worker",
                  executions: 2,
                  retries: 1,
                  next_retry: pending ? 1000 : null,
                  capture_pending: pending,
                  error,
                },
              ],
            },
          ],
        },
  );
  return {
    context: shown.includes(
      "Execution|Project|/shared/project|Backend|codex-sdk|Runtime version|not reported|Run parallel limit|2|Artifacts|not reported",
    ),
    dependencies: shown.includes("Depends on research, design"),
    recovery: shown.includes("worker · 2 executions · 1 recovery retries"),
    pending: shown.includes("Received result retained. File capture needs recovery."),
    retry: shown.includes("Next retry 1970-01-01T00:00:01.000Z"),
    error: error !== null && shown.includes(error),
  };
}

export async function renderedDashboardPagination(hash: string, more: boolean, emptyPage: boolean) {
  const shown = await renderedPage(
    hash,
    [],
    false,
    200,
    false,
    emptyPage ? DashboardPageExercise.EmptyRuns : DashboardPageExercise.None,
    { schema_version: 1, before: 42, next_before: 40, has_more: more },
  );
  const links = linksOf(root).filter((href) => href.startsWith("#/runs?"));
  return { links, emptyPage: shown.includes("No runs in this page") };
}

export async function renderedKnowledge(entry: boolean, empty: boolean): Promise<boolean> {
  const shown = await renderedPage(
    `#/knowledge/${entry ? `run_id=run-1&id=${knowledgeEntry.id}` : ""}`,
    [],
    empty,
  );
  expect(shown).toContain("Read-only inspection");
  expect(shown).toContain(empty ? "Meaning search is ready" : "Meaning search is unavailable");
  expect(shown).toContain(empty ? "No entries" : "Clock safety");
  expect(shown).toContain("Scopes");
  expect(shown).toContain("Kinds");
  expect(shown).toContain("fact: 1 entries");
  expect(shown).toContain("Oldest: 2026-11-13");
  expect(shown).toContain("Oldest: 2026-11-10");
  expect(shown).toContain("newest: 2026-11-12");
  if (entry) {
    expect(shown).toContain("<script>untrusted text</script>");
    expect(shown).toContain("1 earlier versions; promoted from home");
    expect(shown).toContain("mentions");
    expect(shown).toContain("<img src=x onerror=alert(1)>Earlier retained body");
    expect(shown).toContain("Earlier versions");
    const earlier = root.children
      .flatMap((child) => linksOf(child))
      .find((href) => href.includes("before="));
    expect(earlier).toContain(`id=${knowledgeEntry.id}`);
    expect(earlier).toContain("run_id=run-1");
    expect(earlier).toContain("scope=project");
    expect(earlier).toContain("before=1");
  }
  if (empty) expect(shown).toContain("More entries exist");
  return true;
}

export async function renderedPending(knownRun: boolean, tag: boolean): Promise<boolean> {
  const shown = await renderedPage(
    `#/knowledge/state=pending${knownRun ? "&run_id=run-1" : ""}${tag ? "&tag=clock" : ""}`,
    [],
  );
  expect(shown).toContain("States");
  expect(shown).toContain("pending update");
  expect(shown).toContain("candidate candidate-1");
  expect(shown).toContain("attempt 2");
  expect(shown).not.toContain("Open entry");
  return true;
}

export async function renderedDashboardRecovery(
  status: number,
  malformed: boolean,
): Promise<boolean> {
  const shown = await renderedPage("#/run/run-1", [], false, status, malformed);
  expect(shown).toContain("This view is temporarily unavailable");
  expect(shown).toContain("Try again");
  expect(shown).not.toContain("invalid JSON");
  expect(shown).toContain(
    status === 401 || status === 403
      ? "session cookie from a login link"
      : "Check that the Titan server is running",
  );
  return true;
}

async function exercisePage(
  exercise: DashboardPageExercise,
  timers: (() => void)[],
  release: () => void,
): Promise<void> {
  const source = FakeSource.made[0];
  if (exercise === DashboardPageExercise.Retry) {
    root.children.find((node) => node.tag === "button")?.listeners.get("click")?.(
      new Event("click"),
    );
    await waitUntil(async () => FakeSource.made.length > 0);
    expect(textOf(root)).not.toContain("Try again");
  }
  if (exercise === DashboardPageExercise.RefreshFailure) {
    timers[0]?.();
    await waitUntil(async () => textOf(root).includes("Try again"));
  }
  if (exercise === DashboardPageExercise.InvalidEvent) {
    source?.listener?.(new MessageEvent("run-event", { data: "invalid JSON" }));
    expect(textOf(root)).toContain("Reconnecting to live events…");
  }
  if (exercise === DashboardPageExercise.Reconnect) {
    source?.listeners.get("error")?.(new MessageEvent("error"));
    expect(textOf(root)).toContain("Reconnecting to live events…");
    source?.listeners.get("open")?.(new MessageEvent("open"));
  }
  if (exercise === DashboardPageExercise.BoundedEvents) {
    for (let id = 3; id < 210; id++)
      source?.listener?.(
        new MessageEvent("run-event", {
          data: JSON.stringify({ id, time: id, type: "bounded", data: null }),
        }),
      );
    expect(
      root.children.find((node) => node.tag === "ul" && node.children.length > 1)?.children,
    ).toHaveLength(200);
    expect(textOf(root).join("|")).not.toContain("1 attempt_started");
  }
  if (exercise === DashboardPageExercise.BoundedCursors) {
    for (let index = 0; index < 201; index++) {
      const before = FakeSource.made.length;
      globalThis.location.hash = `#/run/cursor-${index}`;
      listeners[0]?.();
      await waitUntil(async () => FakeSource.made.length > before);
    }
    globalThis.location.hash = "#/run/run-1";
    listeners[0]?.();
    await waitUntil(
      async () => FakeSource.made.at(-1)?.url.endsWith("run-1/events?after=2") === true,
    );
  }
  if (exercise === DashboardPageExercise.Navigation) {
    const location = globalThis.location;
    location.hash = "#/knowledge/";
    listeners[0]?.();
    source?.listener?.(
      new MessageEvent("run-event", {
        data: JSON.stringify({ id: 999, time: 999, type: "stale", data: null }),
      }),
    );
    await waitUntil(async () => textOf(root).includes("Scopes"));
    expect(source?.closed).toBe(true);
    expect(textOf(root).join("|")).not.toContain("stale");
  }
  await exerciseFilters(exercise, timers, release);
}

async function exerciseFilters(
  exercise: DashboardPageExercise,
  timers: (() => void)[],
  release: () => void,
): Promise<void> {
  const form = root.children.find((node) => node.tag === "form");
  if (!form) return;
  const inputs = form.children
    .flatMap((label) => label.children)
    .filter((node) => node.tag === "input");
  const [client, session, project] = inputs;
  assert.ok(client && session && project);
  if (exercise === DashboardPageExercise.PreserveFilters)
    expect(inputs.map((input) => input.value)).toEqual(["owner", "session", "/shared/project"]);
  if (exercise === DashboardPageExercise.ApplyFilters) {
    client.value = "  new owner & peer  ";
    session.value = "  session-2 ";
    project.value = "/shared/project";
    form.listeners.get("submit")?.(new Event("submit", { cancelable: true }));
    expect(location.hash).toBe(
      "#/runs?" +
        new URLSearchParams({
          client_id: "new owner & peer",
          harness_session_id: "session-2",
          project_path: "/shared/project",
          limit: "1",
        }),
    );
  }
  if (exercise === DashboardPageExercise.ClearRunFilters) {
    for (const input of inputs) input.value = "  ";
    form.listeners.get("submit")?.(new Event("submit", { cancelable: true }));
    expect(location.hash).toBe("#/runs?limit=1");
    expect(linksOf(form)).toContain("#/");
    client.value = "unfinished edit";
    form.children.find((node) => node.tag === "a")?.listeners.get("click")?.(new Event("click"));
    expect(inputs.map((input) => input.value)).toEqual(["", "", ""]);
  }
  if (exercise === DashboardPageExercise.FocusedFilters) {
    client.value = "unfinished edit";
    Reflect.set(document, "activeElement", client);
    const before = root.children[0];
    timers[0]?.();
    await Bun.sleep(10);
    expect(root.children[0]).toBe(before);
    expect(client.value).toBe("unfinished edit");
    Reflect.set(document, "activeElement", null);
    timers[0]?.();
    Reflect.set(document, "activeElement", client);
    release();
    await Bun.sleep(10);
    expect(root.children[0]).toBe(before);
    expect(client.value).toBe("unfinished edit");
    Reflect.set(document, "activeElement", null);
  }
}

export async function renderedDashboardFilters(exercise: DashboardPageExercise): Promise<boolean> {
  await renderedPage(
    "#/runs?" +
      new URLSearchParams({
        client_id: "owner",
        harness_session_id: "session",
        project_path: "/shared/project",
        before: "42",
        limit: "1",
      }),
    [],
    false,
    200,
    false,
    exercise,
  );
  return true;
}

export async function renderedDashboardInteraction(
  exercise: DashboardPageExercise,
): Promise<boolean> {
  const shown = await renderedPage(
    exercise === DashboardPageExercise.EmptyRuns || exercise === DashboardPageExercise.DelayedList
      ? "#/"
      : exercise === DashboardPageExercise.DelayedKnowledge
        ? "#/knowledge/"
        : "#/run/run-1",
    [],
    false,
    exercise === DashboardPageExercise.Retry ? 500 : 200,
    false,
    exercise,
  );
  expect(shown).toContain(
    exercise === DashboardPageExercise.RefreshFailure
      ? "Try again"
      : exercise === DashboardPageExercise.EmptyRuns
        ? "No runs yet"
        : exercise === DashboardPageExercise.EmptySteps
          ? "No steps yet"
          : [
                DashboardPageExercise.Navigation,
                DashboardPageExercise.DelayedRun,
                DashboardPageExercise.DelayedList,
                DashboardPageExercise.DelayedFailure,
              ].some((value) => value === exercise)
            ? "Scopes"
            : "run-1 passed",
  );
  return true;
}

async function redirectPending(
  exercise: DashboardPageExercise,
  release: () => void,
): Promise<void> {
  const toRun = exercise === DashboardPageExercise.DelayedKnowledge;
  globalThis.location.hash = toRun ? "#/run/race-target" : "#/knowledge/";
  listeners[0]?.();
  await waitUntil(async () => textOf(root).includes(toRun ? "run-1 passed" : "Scopes"));
  release();
  await Bun.sleep(10);
  expect(textOf(root)).toContain(toRun ? "run-1 passed" : "Scopes");
  expect(textOf(root)).not.toContain("Try again");
  expect(FakeSource.made).toHaveLength(toRun ? 1 : 0);
}
