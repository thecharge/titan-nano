import { strict as assert } from "node:assert";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  KnowledgeKind,
  KnowledgeScope,
  KnowledgeTool,
  RunEventKind,
  RunJournal,
  RunJournalFixture,
  RunJournalScenario,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { uuidFromText } from "@titan/core";
import { projectHubPath, ScopedKnowledgeHub, scopedRunHub } from "@titan/knowledge";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type Run,
  type RunEvent,
  type RunHubEntry,
  RunHubEventSchema,
  type RunJournal as RunJournalRecord,
  RunJournalSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { isolatedWorkspace } from "../support/isolated.ts";

const Fixture = RunJournalFixture;
const Everything = [KnowledgeTool.Search, KnowledgeTool.Add];

function workflow(scenario: RunJournalScenario) {
  const persona = { ...Fixture.Persona, tools: [AgentTool.Read, AgentTool.Write] };
  const passed =
    scenario === RunJournalScenario.Passed ||
    scenario === RunJournalScenario.UnwritablePassed ||
    scenario === RunJournalScenario.NextPassed;
  return validateWorkflow({
    name: Fixture.Plan,
    goal: Fixture.Goal,
    personas: {
      [Fixture.Worker]: {
        ...persona,
        outputs: { ok: { type: "boolean" }, marker: { type: "string" } },
      },
      [Fixture.Checker]: persona,
    },
    steps: (passed ? [Fixture.PassStep] : [Fixture.PassStep, Fixture.RefuteStep]).map((id) => ({
      id,
      do: { persona: Fixture.Worker, task: Fixture.Task },
      falsify: [{ persona: Fixture.Checker, task: Fixture.Check }],
      max_attempts: Fixture.Attempts,
    })),
  });
}

function blocked(scenario: RunJournalScenario): boolean {
  return (
    scenario === RunJournalScenario.Unwritable || scenario === RunJournalScenario.UnwritablePassed
  );
}

async function prepare(
  scenario: RunJournalScenario,
  root: string,
): Promise<[ScopedKnowledgeHub, Engine, FakeBackend]> {
  const home = resolve(root, Fixture.Home);
  const hubs = await ScopedKnowledgeHub.open(root, home);
  const backend = new FakeBackend(async (spec) => {
    if (spec.persona_id === Fixture.Worker) {
      if (spec.invocation_id.startsWith(`${Fixture.PassStep}/`))
        await writeFile(resolve(spec.cwd, Fixture.ChangedFile), Fixture.ChangedContent);
      return { json: { ok: true, marker: Fixture.Marker } };
    }
    const refuted = spec.invocation_id.startsWith(`${Fixture.RefuteStep}/`);
    return {
      json: {
        verdict: refuted ? Verdict.Refuted : Verdict.Survived,
        evidence: Fixture.Evidence,
      },
    };
  });
  const scope = blocked(scenario) ? KnowledgeScope.Home : KnowledgeScope.Project;
  const hub =
    scenario === RunJournalScenario.NoHub ? undefined : scopedRunHub(hubs, Everything, scope);
  if (blocked(scenario)) {
    const folder = join(projectHubPath(root), KnowledgeKind.Lesson);
    await rm(folder, { recursive: true, force: true });
    await mkdir(projectHubPath(root), { recursive: true });
    await writeFile(folder, Fixture.Occupied);
  }
  return [hubs, new Engine(() => backend, {}, hub ? { hub } : {}), backend];
}

async function create(engine: Engine, root: string, scenario: RunJournalScenario): Promise<Run> {
  return engine.create({
    project: root,
    config: await resolveConfig({
      home: resolve(root, Fixture.Home),
      project: root,
      overrides: isolatedWorkspace,
    }),
    plan: workflow(scenario),
    backend: Backend.Fake,
    client_id: Fixture.Client,
    submission_id: Fixture.Client,
  });
}

async function events(run: Run): Promise<RunEvent[]> {
  const found: RunEvent[] = [];
  for await (const event of new RunStore(run.root).events()) found.push(event);
  return found;
}

async function journals(hubs: ScopedKnowledgeHub, root: string) {
  const page = await hubs
    .list({
      scope: KnowledgeScope.Project,
      kind: KnowledgeKind.Lesson,
      tag: RunJournal.Tag,
      limit: Fixture.Limit,
    })
    .catch(() => ({ entries: [] }));
  const names = await readdir(join(projectHubPath(root), KnowledgeKind.Lesson)).catch(
    () => [] as string[],
  );
  const kept: [string, RunJournalRecord, boolean][] = [];
  for (const row of page.entries) {
    const { entry } = await hubs.get(row.id);
    kept.push([
      row.id,
      RunJournalSchema.parse(JSON.parse(entry.body)),
      names.some((name) => name.startsWith(row.id)),
    ]);
  }
  return kept;
}

function read(found: readonly RunEvent[]): RunHubEntry[] {
  return found
    .filter((event) => event.type === RunEventKind.HubRead)
    .flatMap((event) => RunHubEventSchema.parse(event.data).entries);
}

async function ended(engine: Engine, root: string, scenario: RunJournalScenario): Promise<Run> {
  const run = await create(engine, root, scenario);
  if (scenario === RunJournalScenario.Cancelled) await engine.cancel(run.run_id);
  else await engine.start(run.run_id);
  return run;
}

export function runJournalRecord(scenario: RunJournalScenario): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const [hubs, engine] = await prepare(scenario, root);
    try {
      const run = await ended(engine, root, scenario);
      const kept = await journals(hubs, root);
      const journal = kept[0]?.[1];
      return [
        run.state,
        kept.length,
        kept.filter((row) => row[2]).length,
        (journal?.steps ?? []).map((step) => `${step.step_id}:${step.state}`).join(Fixture.Join),
        (journal?.steps ?? []).flatMap((step) => step.refusals).join(Fixture.Join),
        (journal?.steps ?? []).flatMap((step) => step.files).join(Fixture.Join),
        (journal?.steps ?? []).flatMap((step) => step.lessons).length,
      ].join(Fixture.Space);
    } finally {
      await hubs.close();
    }
  });
}

export function runJournalBlocked(scenario: RunJournalScenario): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const [hubs, engine] = await prepare(scenario, root);
    try {
      const run = await ended(engine, root, scenario);
      const folder = join(projectHubPath(root), KnowledgeKind.Lesson);
      return [run.state, run.error?.includes(folder) ?? false].join(Fixture.Space);
    } finally {
      await hubs.close();
    }
  });
}

export function runJournalNext(scenario: RunJournalScenario): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const [hubs, engine] = await prepare(scenario, root);
    try {
      await ended(engine, root, scenario);
      const earlier = await journals(hubs, root);
      const second = await ended(engine, root, scenario);
      const all = await events(second);
      const found = read(all);
      const first = all.findIndex((event) => event.type === RunEventKind.ExecutionStarted);
      const at = all.findIndex((event) => event.type === RunEventKind.HubRead);
      return [
        earlier.length,
        earlier.length > 0 && earlier.every((row) => found.some((hit) => hit.id === row[0])),
        at >= 0 && first > at,
      ].join(Fixture.Space);
    } finally {
      await hubs.close();
    }
  });
}

export function runJournalRecovery(
  passed: boolean,
  restart: boolean,
  afterWrite = false,
  cancel = false,
  held = false,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const scenario = passed ? RunJournalScenario.Passed : RunJournalScenario.Finished;
    const [hubs, , backend] = await prepare(scenario, root);
    const hub = scopedRunHub(hubs, Everything, KnowledgeScope.Project);
    let interrupted = true;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let engine = new Engine(
      () => backend,
      {},
      {
        hub: {
          tools: () => hub.tools(),
          read: (goal, project) => hub.read(goal, project),
          keep: (lesson, project) => hub.keep(lesson, project),
          journal: async (journal) => {
            if (interrupted) {
              if (afterWrite) await hub.journal(journal);
              throw new Error("Journal storage interrupted");
            }
            if (held) {
              entered.resolve();
              await release.promise;
            }
            return hub.journal(journal);
          },
        },
      },
    );
    try {
      const run = await ended(engine, root, scenario);
      const first = run.state;
      interrupted = false;
      if (restart) {
        engine = new Engine(() => backend, {}, { hub });
        await engine.load(run.root);
      }
      if (cancel && held) {
        const active = engine.resume(run.run_id);
        await entered.promise;
        const cancellation = engine.cancel(run.run_id);
        release.resolve();
        await cancellation;
        await active;
      } else if (cancel) await engine.cancel(run.run_id);
      else await engine.resume(run.run_id);
      const kept = await journals(hubs, root);
      assert.equal(kept.length, 1);
      const lessons = kept[0]?.[1].steps.flatMap((step) => step.lessons) ?? [];
      const written = (await events(run))
        .filter((event) => event.type === RunEventKind.HubWrote)
        .flatMap((event) => RunHubEventSchema.parse(event.data).entries.map((entry) => entry.id));
      return [
        first,
        engine.get(run.run_id).state,
        lessons.length,
        written.length,
        written.every((id) => lessons.includes(id)),
      ].join(Fixture.Space);
    } finally {
      release.resolve();
      await hubs.close();
    }
  });
}

export function runJournalCancellation(worker: boolean, retry: boolean) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, Fixture.Home);
    const hubs = await ScopedKnowledgeHub.open(root, home);
    const hub = scopedRunHub(hubs, Everything, KnowledgeScope.Project);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let calls = 0;
    let interrupted = retry;
    const backend = new FakeBackend(async (spec) => {
      calls++;
      const working = spec.persona_id === Fixture.Worker;
      if (spec.invocation_id.startsWith(`${Fixture.RefuteStep}/`) && working === worker) {
        entered.resolve();
        await release.promise;
      }
      return {
        json: working
          ? { ok: true, marker: Fixture.Marker }
          : { verdict: Verdict.Survived, evidence: Fixture.Evidence },
      };
    });
    let engine = new Engine(
      () => backend,
      {},
      {
        hub: {
          tools: () => hub.tools(),
          read: (goal, project) => hub.read(goal, project),
          keep: (lesson, project) => hub.keep(lesson, project),
          journal: async (journal) => {
            if (interrupted) throw new Error("Journal storage interrupted");
            return hub.journal(journal);
          },
        },
      },
    );
    const run = await engine.create({
      project: root,
      config: await resolveConfig({ home, project: root }),
      plan: workflow(RunJournalScenario.Finished),
      backend: Backend.Fake,
      client_id: Fixture.Client,
      submission_id: Fixture.Client,
    });
    const active = engine.start(run.run_id);
    try {
      await entered.promise;
      const cancellation = engine.cancel(run.run_id);
      release.resolve();
      await cancellation;
      await active;
      assert.equal(run.state, retry ? RunStatus.Blocked : RunStatus.Cancelled);
      const before = calls;
      interrupted = false;
      if (retry) {
        engine = new Engine(() => backend, {}, { hub });
        await engine.load(run.root);
        await engine.resume(run.run_id);
      }
      const final = await engine.snapshot(run.run_id);
      const saved = await journals(hubs, root);
      const journal = saved[0]?.[1];
      assert.equal(saved.length, 1);
      assert.equal(journal?.state, RunStatus.Cancelled);
      assert.equal(journal?.steps.flatMap((step) => step.lessons).length, 1);
      assert.equal(final.nodes[Fixture.RefuteStep]?.attempt, 1);
      assert.equal(final.nodes[Fixture.RefuteStep]?.refutations, 0);
      return { state: final.state, restarted: calls !== before };
    } finally {
      release.resolve();
      await engine.cancel(run.run_id);
      await active;
      await hubs.close();
    }
  });
}

export function runJournalIdentity(passed: boolean, occupied: boolean) {
  return withTemporaryDirectory(async (root) => {
    const scenario = passed ? RunJournalScenario.Passed : RunJournalScenario.Finished;
    const [hubs, engine] = await prepare(scenario, root);
    const run = await create(engine, root, scenario);
    const id = uuidFromText(JSON.stringify([RunJournal.Id, run.run_id]));
    const local = hubs.hub(KnowledgeScope.Project);
    try {
      if (occupied)
        await local.add({
          id,
          kind: passed ? KnowledgeKind.Fact : KnowledgeKind.Lesson,
          title: "Independent entry",
          body: "{}",
        });
      await engine.start(run.run_id);
      const previous = await local.get(id);
      if (occupied) {
        assert.equal(run.state, RunStatus.Blocked);
        assert.equal(previous.entry.title, "Independent entry");
        assert.equal(previous.entry.body, "{}");
        assert.equal(previous.entry.version, 1);
        assert.equal((await journals(hubs, root)).length, 0);
        return true;
      }
      const record = RunJournalSchema.parse(JSON.parse(previous.entry.body));
      const hub = scopedRunHub(hubs, Everything, KnowledgeScope.Project);
      await hub.journal({ ...record, state: RunStatus.Cancelled });
      const updated = await local.get(id);
      assert.equal(updated.entry.version, previous.entry.version + 1);
      assert.equal(
        RunJournalSchema.parse(JSON.parse(updated.entry.body)).state,
        RunStatus.Cancelled,
      );
      assert.equal((await journals(hubs, root)).length, 1);
      return true;
    } finally {
      await hubs.close();
    }
  });
}
