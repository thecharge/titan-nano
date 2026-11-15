import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  ErrorCode,
  KnowledgeKind,
  KnowledgeScope,
  KnowledgeTool,
  RunEventKind,
  RunHubFixture,
  RunHubOutcome,
  RunHubScenario,
  RunStatus,
  TextSymbol,
  Verdict,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { ScopedKnowledgeHub, scopedRunHub } from "@titan/knowledge";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type KnowledgeClient,
  type Run,
  type RunEvent,
  type RunHubEntry,
  RunHubEventSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

const Everything = [KnowledgeTool.Search, KnowledgeTool.Add];

function offeredTools(scenario: RunHubScenario): readonly string[] {
  if (scenario === RunHubScenario.MissingSearch) return [KnowledgeTool.Add];
  if (scenario === RunHubScenario.MissingAdd) return [KnowledgeTool.Search];
  return Everything;
}

function workflow() {
  const persona = { ...RunHubFixture.Persona, tools: [AgentTool.Read] };
  return validateWorkflow({
    name: RunHubFixture.Plan,
    goal: RunHubFixture.Goal,
    personas: {
      [RunHubFixture.Worker]: {
        ...persona,
        outputs: { ok: { type: "boolean" }, marker: { type: "string" } },
      },
      [RunHubFixture.Checker]: persona,
    },
    steps: [RunHubFixture.PassStep, RunHubFixture.RefuteStep].map((id) => ({
      id,
      do: { persona: RunHubFixture.Worker, task: RunHubFixture.Task },
      falsify: [{ persona: RunHubFixture.Checker, task: RunHubFixture.Check }],
      max_attempts: RunHubFixture.Attempts,
    })),
  });
}

async function holds(client: KnowledgeClient, id: string): Promise<boolean> {
  return client.get(id).then(
    () => true,
    () => false,
  );
}

async function observe(
  scenario: RunHubScenario,
  root: string,
): Promise<[ScopedKnowledgeHub, Run, RunEvent[], Map<string, readonly string[]>]> {
  const home = resolve(root, RunHubFixture.Home);
  const hubs = await ScopedKnowledgeHub.open(root, home);
  if (scenario !== RunHubScenario.NoMatches)
    for (const title of [RunHubFixture.Other, RunHubFixture.Seed])
      await hubs.hub(KnowledgeScope.Project).add({
        kind: KnowledgeKind.Lesson,
        title,
        body: RunHubFixture.SeedText,
        tags: [],
      });
  const tools = new Map<string, readonly string[]>();
  const backend = new FakeBackend(async (spec) => {
    tools.set(spec.persona_id ?? TextSymbol.Empty, spec.tools);
    if (spec.persona_id === RunHubFixture.Worker)
      return { json: { ok: true, marker: RunHubFixture.Marker } };
    const refuted = spec.invocation_id.startsWith(`${RunHubFixture.RefuteStep}/`);
    return {
      json: {
        verdict: refuted ? Verdict.Refuted : Verdict.Survived,
        evidence: RunHubFixture.Evidence,
      },
    };
  });
  const scope =
    scenario === RunHubScenario.HomeScope ? KnowledgeScope.Home : KnowledgeScope.Project;
  const hub =
    scenario === RunHubScenario.NoHub
      ? undefined
      : scopedRunHub(hubs, offeredTools(scenario), scope);
  const engine = new Engine(() => backend, {}, hub ? { hub } : {});
  const run = await engine.create({
    project: root,
    config: await resolveConfig({ home, project: root }),
    plan: workflow(),
    backend: Backend.Fake,
    client_id: RunHubFixture.Client,
    submission_id: RunHubFixture.Client,
  });
  await engine.start(run.run_id);
  const events: RunEvent[] = [];
  for await (const event of new RunStore(run.root).events()) events.push(event);
  return [hubs, run, events, tools];
}

function written(events: readonly RunEvent[]): RunHubEntry[] {
  return events
    .filter((event) => event.type === RunEventKind.HubWrote)
    .flatMap((event) => RunHubEventSchema.parse(event.data).entries);
}

function read(events: readonly RunEvent[]): RunHubEntry[] {
  return events
    .filter((event) => event.type === RunEventKind.HubRead)
    .flatMap((event) => RunHubEventSchema.parse(event.data).entries);
}

function readComesFirst(events: readonly RunEvent[]): boolean {
  const at = events.findIndex((event) => event.type === RunEventKind.HubRead);
  const first = events.findIndex((event) => event.type === RunEventKind.ExecutionStarted);
  return at >= 0 && first > at;
}

async function outcomes(
  hubs: ScopedKnowledgeHub,
  entries: readonly RunHubEntry[],
): Promise<string> {
  const names: string[] = Object.values(RunHubOutcome);
  const found: string[] = [];
  for (const entry of entries) {
    const tags = (await hubs.get(entry.id)).entry.tags;
    found.push(...tags.filter((tag) => names.includes(tag)));
  }
  return found.sort().join(RunHubFixture.Join);
}

export function runHubRecord(scenario: RunHubScenario): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const [hubs, run, events] = await observe(scenario, root);
    try {
      const entries = written(events);
      let inProject = 0;
      let inHome = 0;
      for (const entry of entries) {
        if (await holds(hubs.hub(KnowledgeScope.Project), entry.id)) inProject++;
        if (await holds(hubs.hub(KnowledgeScope.Home), entry.id)) inHome++;
      }
      return [
        run.state,
        read(events).length,
        readComesFirst(events),
        entries.length,
        inProject,
        inHome,
        await outcomes(hubs, entries),
      ].join(RunHubFixture.Space);
    } finally {
      await hubs.close();
    }
  });
}

export function runHubTools(scenario: RunHubScenario): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const [hubs, , , tools] = await observe(scenario, root);
    try {
      return [RunHubFixture.Worker, RunHubFixture.Checker]
        .map((persona) => (tools.get(persona) ?? []).join(RunHubFixture.Join))
        .join(RunHubFixture.Rows);
    } finally {
      await hubs.close();
    }
  });
}

export function runHubStart(scenario: RunHubScenario): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const [hubs, run, events] = await observe(scenario, root);
    try {
      const started = events.filter((event) => event.type === RunEventKind.ExecutionStarted);
      return [run.state, started.length, run.error].join(RunHubFixture.Rows);
    } finally {
      await hubs.close();
    }
  });
}

export async function runHubFinalization(passes: boolean, fails: boolean, resume = false) {
  return withTemporaryDirectory(async (root) => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const entry = {
      id: RunHubFixture.Marker,
      kind: KnowledgeKind.Lesson,
      title: RunHubFixture.Goal,
      scope: KnowledgeScope.Project,
    };
    let dispatched = false;
    const backend = new FakeBackend(async (spec) => {
      if (resume && !dispatched) {
        dispatched = true;
        throw new OperationalError(ErrorCode.KnowledgeUnavailable, RunHubFixture.Evidence);
      }
      return {
        json:
          spec.persona_id === RunHubFixture.Worker
            ? { ok: true, marker: RunHubFixture.Marker }
            : {
                verdict: passes ? Verdict.Survived : Verdict.Refuted,
                evidence: RunHubFixture.Evidence,
              },
      };
    });
    const engine = new Engine(
      () => backend,
      {},
      {
        hub: {
          tools: () => Everything,
          read: async () => [],
          keep: async () => entry,
          journal: async () => {
            entered.resolve();
            await release.promise;
            if (fails) throw new Error(RunHubFixture.Evidence);
            return entry;
          },
        },
      },
    );
    const run = await engine.create({
      project: root,
      config: await resolveConfig({ home: resolve(root, RunHubFixture.Home), project: root }),
      plan: workflow(),
      backend: Backend.Fake,
      client_id: RunHubFixture.Client,
      submission_id: RunHubFixture.Client,
    });
    const working = engine.start(run.run_id);
    await entered.promise;
    const restarting = resume ? engine.resume(run.run_id) : undefined;
    let settled = false;
    const snapshot = engine.snapshot(run.run_id).then((value) => {
      settled = true;
      return value;
    });
    await Bun.sleep(10);
    const waited = !settled;
    release.resolve();
    await working;
    await restarting;
    const initial = await snapshot;
    const saved = resume ? await engine.snapshot(run.run_id) : initial;
    return {
      waited,
      state: saved.state,
      final:
        run.state === (fails ? RunStatus.Blocked : passes ? RunStatus.Passed : RunStatus.Failed),
    };
  });
}
