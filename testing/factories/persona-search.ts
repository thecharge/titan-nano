import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeMeaningFixture,
  KnowledgeMeaningSetup,
  KnowledgeSearchMode,
  KnowledgeVisibilityFixture,
  Packaging,
  PersonaFixture,
  PersonaSearchFixture,
  PersonaState,
  ServerDatabaseAdapter,
} from "@titan/constants";
import { inspectKnowledge, KnowledgeHub } from "@titan/knowledge";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { KnowledgeSearchPageSchema, ScopedKnowledgeSearchPageSchema } from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";
import { runCliCommand } from "../support/command.ts";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";
import { meaningFor } from "./knowledge-meaning.ts";
import { openServer } from "./server-run-hub.ts";

function draft(body: string) {
  return { kind: KnowledgeKind.Persona, title: PersonaFixture.Skeptic, tags: [], body };
}

export function personaPrivateVisibility(state: PersonaState, all: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    let hub = await KnowledgeHub.open(home);
    try {
      const scope = knowledgeAttemptScope();
      const hidden = draft(Bun.YAML.stringify({ state, role: KnowledgeMeaningFixture.Body }));
      const visible = draft(
        Bun.YAML.stringify({ state: PersonaState.Trial, role: KnowledgeMeaningFixture.Body }),
      );
      const final = await hub.add(hidden);
      const privateHidden = await hub.view(scope).add({ private_revision: null, entry: hidden });
      const privateVisible = await hub.view(scope).add({ private_revision: 1, entry: visible });
      await hub.close();
      hub = await KnowledgeHub.open(home);
      const query = { kind: KnowledgeKind.Persona, mode: KnowledgeSearchMode.Words, all, limit: 3 };
      const page = await hub.view(scope).search(query);
      assert.equal(
        page.results.some((row) => row.id === final.entry.id),
        all,
      );
      assert.equal(
        page.results.some((row) => row.id === privateHidden.entry.id),
        all,
      );
      assert.equal(
        page.results.some((row) => row.id === privateVisible.entry.id),
        true,
      );
      assert.equal(page.results.length, all ? 3 : 1);
      const peer = await hub.view(knowledgeAttemptScope()).search(query);
      assert.equal(peer.results.length, all ? 1 : 0);
      assert.equal(
        (await hub.view(scope).get(privateHidden.entry.id)).entry.id,
        privateHidden.entry.id,
      );
      await hub.attempts.publish(scope, 2);
      const published = await hub.search(query);
      assert.equal(published.results.length, all ? 3 : 1);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export function personaSearch(question: string, updates: number, body: string): Promise<string> {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    try {
      let saved = await hub.add(draft(body));
      for (let index = 0; index < updates; index++)
        saved = await hub.update({
          id: saved.entry.id,
          version: saved.entry.version,
          entry: draft(body),
        });
      const page = KnowledgeSearchPageSchema.parse(
        await hub.search({ question, kind: KnowledgeKind.Persona }),
      );
      const first = page.results[0];
      if (!first?.persona) return PersonaSearchFixture.None;
      return [
        first.title,
        first.version,
        first.persona.state,
        first.persona.survived,
        first.persona.refuted,
      ].join(PersonaSearchFixture.Separator);
    } finally {
      await hub.close();
    }
  });
}

export function personaVisibility(
  state: PersonaState,
  mode: KnowledgeSearchMode,
  reopen: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    let hub = await KnowledgeHub.open(
      home,
      {},
      undefined,
      meaningFor(KnowledgeMeaningSetup.Updated),
    );
    try {
      const hidden = await hub.add({
        ...draft(Bun.YAML.stringify({ state, role: KnowledgeMeaningFixture.Body })),
        title: KnowledgeMeaningFixture.Title,
      });
      const visible = await hub.add({
        ...draft(
          Bun.YAML.stringify({ state: PersonaState.Trial, role: KnowledgeMeaningFixture.Body }),
        ),
        title: KnowledgeMeaningFixture.Title,
      });
      if (reopen) {
        await hub.close();
        const database = new Bun.SQL({
          adapter: ServerDatabaseAdapter,
          filename: join(home, KnowledgeFile.Database),
          strict: true,
        });
        try {
          await database.unsafe(KnowledgeVisibilityFixture.DropIndex);
        } finally {
          await database.close();
        }
        hub = await KnowledgeHub.open(
          home,
          {},
          undefined,
          meaningFor(KnowledgeMeaningSetup.Updated),
        );
      }
      const query = {
        question:
          mode === KnowledgeSearchMode.Words
            ? KnowledgeMeaningFixture.Words
            : KnowledgeMeaningFixture.Related,
        mode,
        kind: KnowledgeKind.Persona,
        limit: 1,
      };
      const normal = KnowledgeSearchPageSchema.parse(await hub.search(query));
      assert.equal(normal.results.length, 1);
      assert.equal(normal.results[0]?.id, visible.entry.id);
      const listed = KnowledgeSearchPageSchema.parse(
        await hub.search({
          kind: KnowledgeKind.Persona,
          mode: KnowledgeSearchMode.Words,
          limit: 1,
        }),
      );
      assert.equal(listed.results[0]?.id, visible.entry.id);
      const all = KnowledgeSearchPageSchema.parse(
        await hub.search({ ...query, all: true, limit: 2 }),
      );
      assert.deepEqual(
        new Set(all.results.map((row) => row.id)),
        new Set([hidden.entry.id, visible.entry.id]),
      );
      const again = KnowledgeSearchPageSchema.parse(await hub.search(query));
      assert.equal(again.results.length, 1);
      assert.equal(again.results[0]?.id, visible.entry.id);
      assert.equal((await hub.get(hidden.entry.id)).entry.id, hidden.entry.id);
      const inspection = await inspectKnowledge(home);
      const inspectionQuery = {
        kind: KnowledgeKind.Persona,
        mode: KnowledgeSearchMode.Words,
        limit: 1,
      };
      assert.equal((await inspection.search(inspectionQuery)).results[0]?.id, visible.entry.id);
      assert.equal(
        (await inspection.search({ ...inspectionQuery, all: true, limit: 2 })).results.length,
        2,
      );
      await hub.update({
        id: hidden.entry.id,
        version: 1,
        entry: {
          kind: hidden.entry.kind,
          title: hidden.entry.title,
          tags: hidden.entry.tags,
          body: Bun.YAML.stringify({
            state: PersonaState.Trial,
            role: KnowledgeMeaningFixture.Body,
          }),
        },
      });
      const restored = KnowledgeSearchPageSchema.parse(await hub.search({ ...query, limit: 2 }));
      assert.equal(restored.results.length, 2);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export function personaVisibilityCli(
  state: PersonaState,
  all: boolean,
  restart: boolean,
  cli = Packaging.CliSource,
): Promise<boolean> {
  return withTemporaryDirectory(async (directory) => {
    const home = join(directory, "home");
    const project = join(directory, "project");
    await mkdir(project);
    let server = await openServer(home, createFakeBackend, cli);
    try {
      const client = createKnowledgeClient(home);
      const hidden = await client.add({
        ...draft(Bun.YAML.stringify({ state, role: KnowledgeMeaningFixture.Body })),
        title: KnowledgeMeaningFixture.Title,
      });
      const visible = await client.add({
        ...draft(
          Bun.YAML.stringify({ state: PersonaState.Trial, role: KnowledgeMeaningFixture.Body }),
        ),
        title: KnowledgeMeaningFixture.Title,
      });
      if (restart) {
        await server.stop();
        server = await openServer(home, createFakeBackend, cli);
      }
      const page = ScopedKnowledgeSearchPageSchema.parse(
        await runCliCommand(cli, home, [
          "kb",
          "search",
          KnowledgeMeaningFixture.Words,
          "--project",
          project,
          "--kind",
          KnowledgeKind.Persona,
          "--mode",
          KnowledgeSearchMode.Words,
          ...(all ? ["--all"] : []),
        ]),
      );
      assert.equal(
        page.results.some((row) => row.id === hidden.entry.id),
        all,
      );
      assert.equal(
        page.results.some((row) => row.id === visible.entry.id),
        true,
      );
      assert.equal(page.results.length, all ? 2 : 1);
      assert.equal((await client.get(hidden.entry.id)).entry.id, hidden.entry.id);
      return true;
    } finally {
      await server.stop();
    }
  });
}
