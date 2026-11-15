import { strict as assert } from "node:assert";
import { cp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  IoLimit,
  KnowledgeKind,
  type KnowledgeScope,
  KnowledgeScopeFixture,
  KnowledgeScopeLookup,
  KnowledgeScopeSeed,
  KnowledgeSearchMode,
} from "@titan/constants";
import { jsonByteLength, newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeHub, projectHubHome, projectHubPath, ScopedKnowledgeHub } from "@titan/knowledge";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";

const utc = {
  kind: KnowledgeKind.Fact,
  title: KnowledgeScopeFixture.UtcTitle,
  body: KnowledgeScopeFixture.UtcBody,
};
const zones = {
  kind: KnowledgeKind.Fact,
  title: KnowledgeScopeFixture.ZoneTitle,
  body: KnowledgeScopeFixture.ZoneBody,
};

function label(scope: KnowledgeScope, title: string): string {
  return `${scope}${KnowledgeScopeFixture.Joiner}${title}`;
}

function joined(rows: readonly string[]): string {
  return rows.length ? rows.join(KnowledgeScopeFixture.Rows) : KnowledgeScopeFixture.Nothing;
}

async function seed(hub: ScopedKnowledgeHub, mode: KnowledgeScopeSeed): Promise<string[]> {
  const ids: string[] = [];
  const shared = newId();
  if (mode === KnowledgeScopeSeed.Shared) {
    ids.push((await hub.project.add({ ...utc, id: shared })).entry.id);
    await hub.home.add({ ...zones, id: shared });
    return ids;
  }
  if (mode === KnowledgeScopeSeed.Both || mode === KnowledgeScopeSeed.ProjectOnly)
    ids.push((await hub.project.add(utc)).entry.id);
  if (mode === KnowledgeScopeSeed.Both || mode === KnowledgeScopeSeed.HomeOnly)
    ids.push((await hub.home.add(zones)).entry.id);
  return ids;
}

export function scopedSearch(mode: KnowledgeScopeSeed, question: string): Promise<string> {
  return withTemporaryDirectory(async (directory) => {
    const hub = await ScopedKnowledgeHub.open(
      join(directory, KnowledgeScopeFixture.Project),
      join(directory, KnowledgeScopeFixture.Home),
    );
    try {
      await seed(hub, mode);
      const page = await hub.search({ question, mode: KnowledgeSearchMode.Words });
      jsonByteLength(page, IoLimit.ResponseBytes);
      return joined(page.results.map((result) => label(result.scope, result.title)));
    } finally {
      await hub.close();
    }
  });
}

export function scopedLookup(lookup: KnowledgeScopeLookup): Promise<string> {
  return withTemporaryDirectory(async (directory) => {
    const hub = await ScopedKnowledgeHub.open(
      join(directory, KnowledgeScopeFixture.Project),
      join(directory, KnowledgeScopeFixture.Home),
    );
    try {
      const [projectId, homeId] = await seed(hub, KnowledgeScopeSeed.Both);
      if (lookup === KnowledgeScopeLookup.Project || lookup === KnowledgeScopeLookup.Home) {
        const id = lookup === KnowledgeScopeLookup.Project ? projectId : homeId;
        assert.ok(id);
        const found = await hub.get(id);
        return label(found.scope, found.entry.title);
      }
      if (lookup === KnowledgeScopeLookup.Missing) {
        const error = await thrownBy(async () => {
          await hub.get(newId());
        });
        return error instanceof TitanError ? error.code : KnowledgeScopeFixture.Nothing;
      }
      const listed = await hub.list(
        lookup === KnowledgeScopeLookup.Limited ? { limit: KnowledgeScopeFixture.Limit } : {},
      );
      return [
        joined(listed.entries.map((entry) => label(entry.scope, entry.title))),
        listed.truncated ? KnowledgeScopeFixture.Truncated : KnowledgeScopeFixture.Complete,
      ].join(KnowledgeScopeFixture.Rows);
    } finally {
      await hub.close();
    }
  });
}

export function scopedClone(copy: boolean, question: string): Promise<string> {
  return withTemporaryDirectory(async (directory) => {
    const origin = join(directory, KnowledgeScopeFixture.Project);
    const cloned = join(directory, KnowledgeScopeFixture.Cloned);
    const home = join(directory, KnowledgeScopeFixture.Home);
    const first = await ScopedKnowledgeHub.open(origin, home);
    try {
      await first.project.add(utc);
    } finally {
      await first.close();
    }
    if (copy) await cp(projectHubPath(origin), projectHubPath(cloned), { recursive: true });
    const second = await ScopedKnowledgeHub.open(
      cloned,
      join(directory, KnowledgeScopeFixture.Elsewhere),
    );
    try {
      const page = await second.search({
        question,
        mode: KnowledgeSearchMode.Words,
      });
      jsonByteLength(page, IoLimit.ResponseBytes);
      return joined(page.results.map((result) => label(result.scope, result.title)));
    } finally {
      await second.close();
    }
  });
}

export function scopedOpen(homeIsFile: boolean): Promise<string> {
  return withTemporaryDirectory(async (directory) => {
    const project = join(directory, KnowledgeScopeFixture.Project);
    const home = join(directory, KnowledgeScopeFixture.Home);
    if (homeIsFile) await writeFile(home, KnowledgeScopeFixture.NotFile);
    const opened = await thrownBy(async () => {
      await (
        await ScopedKnowledgeHub.open(project, join(home, KnowledgeScopeFixture.Home))
      ).close();
    });
    if (!opened) return KnowledgeScopeFixture.Opened;
    const again = await KnowledgeHub.open(projectHubHome(project));
    await again.close();
    return `${KnowledgeScopeFixture.Refused}${KnowledgeScopeFixture.Joiner}${KnowledgeScopeFixture.Reopened}`;
  });
}
