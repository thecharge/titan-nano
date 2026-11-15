import { strict as assert } from "node:assert";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  ConfigFile,
  FakeScriptLimit,
  RunHubFixture as Fixture,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  LiveWorkspaceFixture,
  RunEventKind,
  RunJournal,
  RunStatus,
  Verdict,
} from "@titan/constants";
import {
  parseKnowledgeEntry,
  parseKnowledgeFile,
  personaEntryId,
  projectHubPath,
} from "@titan/knowledge";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendFactory,
  PersonaRecordSchema,
  RunHubEventSchema,
  RunJournalSchema,
} from "@titan/types";
import { serverReady, spawnServer } from "./server-process.ts";

export async function openServer(home: string, backend: BackendFactory, cli?: string) {
  if (!cli) return startServer(home, backend);
  const child = spawnServer(home, cli, 15000);
  if (!(await waitUntil(() => serverReady(home, child.pid)))) {
    child.kill("SIGTERM");
    await child.exited;
    assert.fail("The production CLI server must become ready");
  }
  return {
    async stop() {
      if (child.exitCode === null) child.kill("SIGTERM");
      await child.exited;
    },
  };
}

async function journals(project: string): Promise<string[]> {
  return readdir(join(projectHubPath(project), KnowledgeKind.Lesson))
    .then((names) => names.filter((name) => name.endsWith(KnowledgeFile.Markdown)))
    .catch(() => []);
}

async function savedJournal(project: string, run: string) {
  for (const name of await journals(project)) {
    const document = parseKnowledgeFile(
      await readFile(join(projectHubPath(project), KnowledgeKind.Lesson, name)),
      KnowledgeLimit.EntryBytes,
    );
    if (!document.tags.includes(RunJournal.Tag)) continue;
    const journal = RunJournalSchema.parse(JSON.parse(document.body));
    if (journal.run_id === run) return [document.id, journal] as const;
  }
  return null;
}

async function personaResult(
  home: string,
  persona: string,
  run: string,
  passes: boolean,
): Promise<void> {
  const path = join(
    home,
    KnowledgeFile.Directory,
    KnowledgeKind.Persona,
    personaEntryId(`${persona}@1`) + KnowledgeFile.Yaml,
  );
  const entry = parseKnowledgeEntry(await readFile(path), KnowledgeLimit.EntryBytes);
  const record = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
  assert.equal(record.history?.length, 1);
  assert.equal(record.history[0]?.run, run);
  assert.equal(record.runs, 1);
  if (persona === Fixture.Worker) {
    assert.equal(record.survived, passes ? 1 : 0);
    assert.equal(record.refuted, passes ? 0 : 1);
  } else assert.equal(record.falsifier_refutations, passes ? 0 : 1);
}

export async function serverHub(
  passes: boolean,
  restart: boolean,
  same: boolean,
  unwritable: boolean,
  shared = false,
  cli?: string,
) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, LiveWorkspaceFixture.Project);
    const home = shared ? resolve(project, ConfigFile.HomeDirectory) : resolve(root, Fixture.Home);
    const other = resolve(root, LiveWorkspaceFixture.Target);
    await mkdir(project);
    await mkdir(other);
    if (unwritable) {
      const directory = projectHubPath(project);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, KnowledgeKind.Lesson), Fixture.Marker);
    }
    const backend = () =>
      new FakeBackend(async (spec) => ({
        json: spec.writable
          ? { ok: true }
          : { verdict: passes ? Verdict.Survived : Verdict.Refuted, evidence: Fixture.Evidence },
      }));
    const workflow = {
      name: Fixture.Plan,
      goal: Fixture.Goal,
      personas: { [Fixture.Worker]: Fixture.Persona, [Fixture.Checker]: Fixture.Persona },
      ...(cli
        ? {
            backends: {
              fake: {
                script: {
                  version: FakeScriptLimit.Version,
                  answers: [
                    { persona: Fixture.Worker, task: Fixture.Task, answer: { ok: true } },
                    {
                      persona: Fixture.Checker,
                      task: Fixture.Check,
                      answer: {
                        verdict: passes ? Verdict.Survived : Verdict.Refuted,
                        evidence: Fixture.Evidence,
                      },
                    },
                  ],
                },
              },
            },
          }
        : {}),
      steps: [
        {
          id: Fixture.PassStep,
          do: { persona: Fixture.Worker, task: Fixture.Task },
          falsify: [{ persona: Fixture.Checker, task: Fixture.Check }],
          max_attempts: Fixture.Attempts,
        },
      ],
    };
    let server = await openServer(home, backend, cli);
    const client = createRunClient(home);
    const body = {
      project,
      workflow,
      backend: Backend.Fake,
      client_id: Fixture.Client,
      submission_id: Fixture.PassStep,
    };
    try {
      const first = await client.submit(body);
      assert.ok(
        await waitUntil(async () => {
          const state = (await client.get(first.run_id)).state;
          return unwritable
            ? state === RunStatus.Blocked
            : (await savedJournal(project, first.run_id)) !== null;
        }),
      );
      const before = await client.get(first.run_id);
      if (unwritable) return { state: before.state, journal: false, reread: false };
      const saved = await savedJournal(project, first.run_id);
      assert.ok(saved);
      const [id, journal] = saved;
      await personaResult(home, Fixture.Worker, first.run_id, passes);
      await personaResult(home, Fixture.Checker, first.run_id, passes);
      assert.equal(journal.run_id, first.run_id);
      assert.equal(journal.state, before.state);
      if (restart) {
        await server.stop();
        server = await openServer(home, backend, cli);
      }
      const nextProject = same ? project : other;
      const next = await client.submit({
        ...body,
        project: nextProject,
        submission_id: Fixture.RefuteStep,
      });
      assert.ok(
        await waitUntil(async () => (await savedJournal(nextProject, next.run_id)) !== null),
      );
      const events = await client.events(next.run_id);
      const read = events.events.find((event) => event.type === RunEventKind.HubRead);
      assert.ok(read);
      const entries = RunHubEventSchema.parse(read.data).entries;
      const worker = events.events.find((event) => event.type === RunEventKind.ExecutionStarted);
      assert.ok(worker && read.id < worker.id);
      return {
        state: before.state,
        journal: true,
        reread: entries.some((entry) => entry.id === id),
      };
    } finally {
      await server.stop();
    }
  });
}

export function serverHubProcess(
  passes: boolean,
  restart: boolean,
  same: boolean,
  unwritable: boolean,
  shared = false,
  cli = resolve("apps/cli/src/main.ts"),
) {
  return serverHub(passes, restart, same, unwritable, shared, cli);
}
