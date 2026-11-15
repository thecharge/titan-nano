import { strict as assert } from "node:assert";
import { link, mkdir, readFile, rename, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  DashboardHeader,
  DashboardRoute,
  ErrorCode,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgeScope,
  RunStatus,
  ServerCredential,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { inspectKnowledge, KnowledgeHub, knowledgeBytes, projectHubHome } from "@titan/knowledge";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type DashboardCodeBody,
  DashboardKnowledgeSchema,
  KnowledgeHistoryPageSchema,
  ScopedKnowledgeShowSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { schemaFakeAnswer } from "../support/backend.ts";
import { withClientAddress } from "../support/client.ts";
import { knowledgeDraft } from "./knowledge.ts";

export async function retainedKnowledgeHistory(kind: KnowledgeKind, mode: string) {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    try {
      const first = await hub.add(knowledgeDraft(kind));
      const id = first.entry.id;
      let current = first;
      const updates = mode === "empty" ? 0 : mode === "bytes" ? 10 : 3;
      for (let index = 0; index < updates; index++)
        current = await hub.update({
          id,
          version: current.entry.version,
          entry: {
            ...knowledgeDraft(kind),
            body:
              mode === "bytes"
                ? "a".repeat(KnowledgeLimit.EntryBytes - 4096)
                : `Retained body ${index + 2}`,
          },
        });
      const extension =
        kind === KnowledgeKind.Persona ? KnowledgeFile.Yaml : KnowledgeFile.Markdown;
      const directory = join(home, KnowledgeFile.Directory, KnowledgeFile.History, kind, id);
      const path = join(directory, `${current.entry.version - 1}${extension}`);
      if (mode === "missing") await rm(path);
      if (mode === "malformed") await writeFile(path, "malformed retained entry");
      if (["identity", "kind", "version"].includes(mode))
        await writeFile(
          path,
          knowledgeBytes(
            {
              ...first.entry,
              id: mode === "identity" ? newId() : id,
              kind: mode === "kind" ? KnowledgeKind.Plan : kind,
              version: mode === "version" ? 1 : current.entry.version - 1,
            },
            KnowledgeLimit.EntryBytes,
          ),
        );
      if (mode === "link" || mode === "hard-link") {
        const other = join(home, "retained-copy");
        await writeFile(other, await readFile(path));
        await rm(path);
        if (mode === "link") await symlink(other, path);
        else await link(other, path);
      }
      if (mode === "parent-link") {
        const other = join(home, "retained-directory");
        await rename(directory, other);
        await symlink(other, directory);
      }
      if (mode === "root-link") {
        const root = join(home, KnowledgeFile.Directory);
        const other = join(home, "linked-root");
        await rename(root, other);
        await symlink(other, root);
      }
      const bad = [
        "missing",
        "malformed",
        "identity",
        "kind",
        "version",
        "link",
        "hard-link",
        "parent-link",
        "root-link",
        "cursor",
      ].includes(mode);
      const query = {
        id,
        ...(mode === "cursor" ? { before: current.entry.version + 1 } : {}),
        limit: mode === "page" ? 1 : KnowledgeLimit.MaximumPage,
      };
      const error = await thrownBy(async () => {
        const page = await hub.history(query);
        if (mode === "empty") assert.deepEqual(page.entries, []);
        else assert.equal(page.entries[0]?.version, current.entry.version - 1);
        if (mode === "page") {
          assert.equal(page.next_before, 3);
          const second = await hub.history({ id, before: page.next_before, limit: 1 });
          assert.equal(second.entries[0]?.version, 2);
          const last = await hub.history({ id, before: second.next_before, limit: 1 });
          assert.deepEqual(last.entries, [first.entry]);
          assert.equal(last.next_before, null);
        }
        if (mode === "bytes") {
          assert.ok(page.next_before !== null);
          assert.ok(Buffer.byteLength(JSON.stringify(page.entries)) <= KnowledgeLimit.HistoryBytes);
        }
        assert.equal((await hub.stats()).never_read, 1);
        await hub.close();
        const database = join(home, KnowledgeFile.Database);
        const before = await readFile(database);
        const view = await inspectKnowledge(home);
        assert.deepEqual(await view.history(query), page);
        assert.equal((await view.stats()).never_read, 1);
        assert.deepEqual(await readFile(database), before);
      });
      assert.equal(error !== undefined, bad);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function knowledgeHistoryReply(mode: string) {
  const id = "11111111-1111-4111-8111-111111111111";
  const page = KnowledgeHistoryPageSchema.parse({
    schema_version: 1,
    revision: "a".repeat(64),
    id,
    kind: KnowledgeKind.Fact,
    current_version: 3,
    entries: [{ ...knowledgeDraft(KnowledgeKind.Fact), id, version: 2 }],
    next_before: 2,
  });
  if (mode === "bytes") {
    page.current_version = 10;
    page.entries = Array.from({ length: 9 }, (_value, index) => ({
      ...knowledgeDraft(KnowledgeKind.Fact),
      id,
      version: 9 - index,
      body: "a".repeat(KnowledgeLimit.EntryBytes - 4096),
    }));
    page.next_before = null;
  }
  if (mode === "identity") page.id = newId();
  if (mode === "order")
    page.entries[0] = { ...page.entries[0], ...knowledgeDraft(KnowledgeKind.Fact), id, version: 1 };
  if (mode === "kind") page.kind = KnowledgeKind.Lesson;
  if (mode === "cursor") page.next_before = 3;
  if (mode === "empty") page.entries = [];
  if (mode === "last") {
    page.current_version = 2;
    page.entries[0] = { ...knowledgeDraft(KnowledgeKind.Fact), id, version: 1 };
    page.next_before = null;
  }
  return withClientAddress(Response.json(mode === "malformed" ? {} : page), async (home) => {
    const error = await thrownBy(() =>
      createKnowledgeClient(home).history({ id: mode === "invalid" ? "bad-id" : id, limit: 1 }),
    );
    assert.equal(error === undefined, mode === "page" || mode === "last");
    return true;
  });
}

export async function knowledgeKindDates(reverse: boolean, inspect: boolean) {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    try {
      const fact = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
      const lesson = await hub.add(knowledgeDraft(KnowledgeKind.Lesson));
      const entries = reverse ? [lesson.entry, fact.entry] : [fact.entry, lesson.entry];
      for (const [index, entry] of entries.entries())
        await utimes(
          join(home, KnowledgeFile.Directory, entry.kind, entry.id + KnowledgeFile.Markdown),
          index + 1,
          index + 1,
        );
      const source = inspect ? await inspectKnowledge(home) : hub;
      const stats = await source.stats();
      assert.equal(stats.oldest?.id, entries[0]?.id);
      assert.equal(stats.newest?.id, entries[1]?.id);
      for (const entry of entries) {
        const kind = stats.kinds.find((row) => row.kind === entry.kind);
        assert.equal(kind?.oldest?.id, entry.id);
        assert.equal(kind?.newest?.id, entry.id);
      }
      await utimes(
        join(
          home,
          KnowledgeFile.Directory,
          entries[0]?.kind ?? KnowledgeKind.Fact,
          entries[0]?.id + KnowledgeFile.Markdown,
        ),
        5,
        5,
      );
      const changed = await source.stats();
      assert.equal(changed.newest?.id, entries[0]?.id);
      assert.equal(
        changed.kinds.find((row) => row.kind === entries[0]?.kind)?.newest?.updated,
        "1970-01-01T00:00:05.000Z",
      );
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function knowledgeHistorySurface(scope: KnowledgeScope, invalid: boolean) {
  return withTemporaryDirectory(async (root) => {
    const home = join(root, "home");
    const project = join(root, "project");
    await mkdir(project);
    const selected = scope === KnowledgeScope.Project ? projectHubHome(project) : home;
    const hub = await KnowledgeHub.open(selected);
    const first = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
    await hub.update({
      id: first.entry.id,
      version: 1,
      entry: { ...knowledgeDraft(KnowledgeKind.Fact), body: "Changed current body" },
    });
    await hub.close();
    const server = await startServer(home, () => new FakeBackend(schemaFakeAnswer));
    try {
      const client = createRunClient(home);
      const run = await client.submit({
        workflow: vendorRecoveryWorkflow(),
        project,
        backend: Backend.Fake,
        client_id: "history",
        submission_id: "history",
        workflow_path: "workflow.yaml",
      });
      assert.ok(
        await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed),
      );
      let output: unknown;
      const cli = createCli({
        ...defaultServices,
        output: (value) => {
          output = value;
        },
      });
      const error = await thrownBy(() =>
        cli([
          "kb",
          "show",
          first.entry.id,
          "--home",
          home,
          "--project",
          project,
          "--scope",
          scope,
          "--limit",
          "1",
          "--before",
          invalid ? "99" : "2",
          "--json",
        ]),
      );
      if (invalid) {
        assert.ok(error instanceof TitanError);
        assert.equal(error.code, ErrorCode.KnowledgeInvalid);
      } else {
        assert.equal(error, undefined);
        assert.deepEqual(ScopedKnowledgeShowSchema.parse(output).history.page.entries, [
          first.entry,
        ]);
      }
      if (scope === KnowledgeScope.Home) {
        const history = await createKnowledgeClient(home).history({
          id: first.entry.id,
          before: 2,
          limit: 1,
        });
        assert.deepEqual(history.entries, [first.entry]);
      }
      const person = (await readFile(join(home, ServerCredential.PersonFile), "utf8")).trim();
      const minted = await fetch(server.address.url + DashboardRoute.Code, {
        method: "POST",
        headers: { authorization: `Bearer ${person}` },
      });
      const code = ((await minted.json()) as DashboardCodeBody).code;
      const login = await fetch(`${server.address.url}${DashboardRoute.Login}?code=${code}`, {
        redirect: "manual",
      });
      const cookie = login.headers.get(DashboardHeader.SetCookie)?.split(";")[0] ?? "";
      const query = new URLSearchParams({
        run_id: run.run_id,
        scope,
        id: first.entry.id,
        before: invalid ? "99" : "2",
      });
      const before = await readFile(join(selected, KnowledgeFile.Database));
      const response = await fetch(`${server.address.url}${DashboardRoute.Knowledge}?${query}`, {
        headers: { cookie },
      });
      assert.equal(response.ok, !invalid);
      if (!invalid) {
        const shown = DashboardKnowledgeSchema.parse(await response.json());
        assert.deepEqual(shown.entry?.history.page.entries, [first.entry]);
        assert.ok(
          shown.stats.scopes
            .find((entry) => entry.scope === scope)
            ?.kinds.find((entry) => entry.kind === KnowledgeKind.Fact)?.oldest,
        );
      }
      assert.deepEqual(await readFile(join(selected, KnowledgeFile.Database)), before);
      return true;
    } finally {
      await server.stop();
    }
  });
}

export async function retainedHistoryFraming(offset: number, inspection: boolean) {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    const first = await hub.add(knowledgeDraft(KnowledgeKind.Fact));
    let current = first;
    try {
      for (let version = 2; version <= 10; version++)
        current = await hub.update({
          id: first.entry.id,
          version: current.entry.version,
          entry: knowledgeDraft(KnowledgeKind.Fact),
        });
      await hub.close();
      const empty = { ...first.entry, body: "" };
      const overhead = Buffer.byteLength(JSON.stringify(empty)) * 9;
      const allowance = KnowledgeLimit.HistoryBytes + offset - overhead;
      const length = Math.floor(allowance / 9);
      const extra = allowance - length * 9;
      for (let version = 1; version <= 9; version++)
        await writeFile(
          join(
            home,
            KnowledgeFile.Directory,
            KnowledgeFile.History,
            first.entry.kind,
            first.entry.id,
            `${version}${KnowledgeFile.Markdown}`,
          ),
          knowledgeBytes(
            { ...first.entry, version, body: "a".repeat(length + (version === 1 ? extra : 0)) },
            KnowledgeLimit.EntryBytes,
          ),
        );
      const reader = inspection ? await inspectKnowledge(home) : await KnowledgeHub.open(home);
      try {
        const page = await reader.history({
          id: first.entry.id,
          limit: KnowledgeLimit.MaximumPage,
        });
        assert.ok(Buffer.byteLength(JSON.stringify(page.entries)) <= KnowledgeLimit.HistoryBytes);
        assert.equal(page.entries.length, offset <= -10 ? 9 : 8);
        if (offset <= -10) {
          assert.equal(
            Buffer.byteLength(JSON.stringify(page.entries)),
            KnowledgeLimit.HistoryBytes + offset + 10,
          );
          assert.equal(page.next_before, null);
        } else {
          assert.equal(page.next_before, 2);
          const last = await reader.history({ id: first.entry.id, before: page.next_before });
          assert.equal(last.entries.length, 1);
          assert.equal(last.entries[0]?.version, 1);
          assert.equal(last.next_before, null);
        }
        return true;
      } finally {
        if (reader instanceof KnowledgeHub) await reader.close();
      }
    } finally {
      await hub.close();
    }
  });
}
