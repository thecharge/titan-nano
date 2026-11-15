import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  IoLimit,
  KnowledgeCliScopeCase,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeScope,
  KnowledgeScopeFixture,
} from "@titan/constants";
import { jsonByteLength, newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeHub, projectHubHome, projectHubPath } from "@titan/knowledge";
import { startServer } from "@titan/server";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ScopedKnowledgeEntryResultSchema,
  ScopedKnowledgeListResultSchema,
  ScopedKnowledgeSearchPageSchema,
  ScopedKnowledgeShowSchema,
  ScopedKnowledgeStatsSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";

function factText(title: string, body: string) {
  return `---\nkind: fact\ntitle: ${title}\n---\n${body}`;
}

function joined(...parts: readonly (string | number | boolean)[]): string {
  return parts.join(KnowledgeScopeFixture.Joiner);
}

export function knowledgeCliScope(which: KnowledgeCliScopeCase): Promise<string> {
  return withTemporaryDirectory(async (directory) => {
    const home = join(directory, KnowledgeScopeFixture.Home);
    const project = join(directory, KnowledgeScopeFixture.Project);
    await using resources = new AsyncDisposableStack();
    const server = await startServer(home, createFakeBackend);
    resources.defer(() => server.stop());
    async function run(args: string[]) {
      let result: unknown;
      const cli = createCli({
        ...defaultServices,
        output: (value) => {
          jsonByteLength(value, IoLimit.ResponseBytes);
          result = value;
        },
      });
      const failure = await thrownBy(async () => {
        await cli([...args, "--home", home, "--project", project, "--json"]);
      });
      return {
        code: failure instanceof TitanError ? failure.code : KnowledgeScopeFixture.Nothing,
        result,
      };
    }
    async function add(title: string, body: string, scope?: string) {
      const source = join(directory, `${newId()}.md`);
      await writeFile(source, factText(title, body));
      const { result } = await run([
        "kb",
        "add",
        source,
        ...(scope === undefined ? [] : ["--scope", scope]),
      ]);
      return ScopedKnowledgeEntryResultSchema.parse(result).entry.id;
    }
    async function stored(id: string, root: string) {
      return exists(join(root, KnowledgeKind.Fact, id + KnowledgeFile.Markdown));
    }
    const homeRoot = join(home, KnowledgeFile.Directory);
    const projectRoot = projectHubPath(project);
    const utc = [KnowledgeScopeFixture.UtcTitle, KnowledgeScopeFixture.UtcBody] as const;
    const zones = [KnowledgeScopeFixture.ZoneTitle, KnowledgeScopeFixture.ZoneBody] as const;

    if (which === KnowledgeCliScopeCase.DefaultAdd) {
      const id = await add(...utc);
      return joined(await stored(id, projectRoot), await stored(id, homeRoot));
    }
    if (which === KnowledgeCliScopeCase.HomeAdd) {
      const id = await add(...zones, KnowledgeScope.Home);
      return joined(await stored(id, projectRoot), await stored(id, homeRoot));
    }
    if (which === KnowledgeCliScopeCase.BadScope) {
      const source = join(directory, "bad.md");
      await writeFile(source, factText(...utc));
      const bad = await run(["kb", "add", source, "--scope", KnowledgeScopeFixture.Missing]);
      return joined(bad.code, await exists(projectRoot));
    }
    if (which === KnowledgeCliScopeCase.Search) {
      await add(...utc);
      await add(...zones, KnowledgeScope.Home);
      const { result } = await run(["kb", "search", KnowledgeScopeFixture.Question]);
      return ScopedKnowledgeSearchPageSchema.parse(result)
        .results.map((row) => joined(row.scope, row.title))
        .join(KnowledgeScopeFixture.Rows);
    }
    if (which === KnowledgeCliScopeCase.Stats || which === KnowledgeCliScopeCase.StatsAfterRead) {
      const first = await add(...utc);
      await add(...zones, KnowledgeScope.Home);
      if (which === KnowledgeCliScopeCase.StatsAfterRead) await run(["kb", "get", first]);
      const { result } = await run(["kb", "stats"]);
      return ScopedKnowledgeStatsSchema.parse(result)
        .scopes.map((row) => joined(row.scope, row.entries, row.never_read))
        .join(KnowledgeScopeFixture.Rows);
    }
    if (which === KnowledgeCliScopeCase.List) {
      await add(...utc);
      await add(...zones, KnowledgeScope.Home);
      const { result } = await run(["kb", "list"]);
      return ScopedKnowledgeListResultSchema.parse(result)
        .entries.map((row) => joined(row.scope, row.title))
        .join(KnowledgeScopeFixture.Rows);
    }
    if (which === KnowledgeCliScopeCase.ListBadLimit)
      return String((await run(["kb", "list", "--limit", KnowledgeScopeFixture.Missing])).code);
    if (which === KnowledgeCliScopeCase.WaitsForProject) {
      const held = await KnowledgeHub.open(projectHubHome(project));
      const waiting = run(["kb", "stats"]);
      await sleep(KnowledgeScopeFixture.HoldMilliseconds);
      await held.close();
      const { result } = await waiting;
      return String(ScopedKnowledgeStatsSchema.parse(result).scopes.length);
    }
    if (which === KnowledgeCliScopeCase.ProjectIsFile) {
      const blocker = join(directory, KnowledgeScopeFixture.Blocker);
      await writeFile(blocker, KnowledgeScopeFixture.Blocker);
      const failed = await thrownBy(async () => {
        await createCli({ ...defaultServices, output: () => undefined })([
          "kb",
          "stats",
          "--home",
          home,
          "--project",
          blocker,
          "--json",
        ]);
      });
      return String(failed !== undefined);
    }
    if (which === KnowledgeCliScopeCase.ShowTagged) {
      const source = join(directory, KnowledgeScopeFixture.Blocker);
      await writeFile(source, factText(...utc).replace("kind: fact", "kind: fact\ntags: [clock]"));
      const added = ScopedKnowledgeEntryResultSchema.parse(
        (await run(["kb", "add", source])).result,
      );
      const shown = ScopedKnowledgeShowSchema.parse(
        (await run(["kb", "show", added.entry.id])).result,
      );
      return joined(
        shown.entry.tags.join(KnowledgeScopeFixture.Rows),
        shown.history.promoted_from === null,
      );
    }
    if (which === KnowledgeCliScopeCase.ShowMissing)
      return String((await run(["kb", "show", newId()])).code);
    if (which === KnowledgeCliScopeCase.ShowMention) {
      const target = await add(...zones, KnowledgeScope.Home);
      const mentioning = await add(KnowledgeScopeFixture.UtcTitle, `see ${target}`);
      const { result } = await run(["kb", "show", mentioning]);
      const shown = ScopedKnowledgeShowSchema.parse(result);
      return shown.links
        .map((link) => joined(link.relation, link.scope, link.id === target))
        .join(KnowledgeScopeFixture.Rows);
    }
    const id = await add(
      ...utc,
      which === KnowledgeCliScopeCase.UpdateHome ? KnowledgeScope.Home : undefined,
    );
    if (which === KnowledgeCliScopeCase.UpdateHome) {
      const next = join(directory, "next.md");
      await writeFile(
        next,
        factText(KnowledgeScopeFixture.UtcTitle, KnowledgeScopeFixture.ZoneBody),
      );
      await run(["kb", "update", id, next, "--entry-version", "1"]);
      const got = ScopedKnowledgeEntryResultSchema.parse((await run(["kb", "get", id])).result);
      return joined(got.scope, got.entry.version, got.entry.body);
    }
    if (which === KnowledgeCliScopeCase.DeleteProject) {
      const removed = await run(["kb", "delete", id, "--entry-version", "1"]);
      const after = await run(["kb", "get", id]);
      return joined(removed.code, after.code, await stored(id, projectRoot));
    }
    if (which === KnowledgeCliScopeCase.PromoteMissing)
      return String((await run(["kb", "promote", newId()])).code);
    const first = await run(["kb", "promote", id]);
    if (which === KnowledgeCliScopeCase.PromoteTwice)
      return String((await run(["kb", "promote", id])).code);
    return joined(first.code, await stored(id, projectRoot), await stored(id, homeRoot));
  });
}
