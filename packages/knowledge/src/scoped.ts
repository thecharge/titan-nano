import { join } from "node:path";
import {
  ConfigFile,
  ErrorCode,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgePattern,
  KnowledgePromote,
  KnowledgeRelation,
  KnowledgeScope,
  KnowledgeSearchMode,
  KnowledgeState,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  type KnowledgeClient,
  type KnowledgeHistoryWindow,
  type KnowledgeLink,
  type KnowledgeMeaning,
  type KnowledgePendingReader,
  KnowledgeScopeSchema,
  type KnowledgeSettingsInput,
  type KnowledgeStageObserver,
  type ScopedKnowledgeEntryResult,
  type ScopedKnowledgeListEntry,
  type ScopedKnowledgeListInput,
  type ScopedKnowledgeListResult,
  ScopedKnowledgeListSchema,
  type ScopedKnowledgeSearchPage,
  ScopedKnowledgeSearchPageSchema,
  type ScopedKnowledgeShow,
  ScopedKnowledgeShowSchema,
  type ScopedKnowledgeStats,
} from "@titan/types";
import { KnowledgeHub } from "./hub.ts";
import { inspectPendingKnowledge } from "./pending-inspection.ts";
import { limitSearchRows } from "./search.ts";

export function projectHubHome(project: string): string {
  return join(project, ConfigFile.HomeDirectory);
}

export function projectHubPath(project: string): string {
  return join(projectHubHome(project), KnowledgeFile.Directory);
}

export class ScopedKnowledgeHub {
  private constructor(
    readonly project: KnowledgeClient,
    readonly home: KnowledgeClient,
    private readonly release: () => Promise<void>,
    private readonly pending?: KnowledgePendingReader,
  ) {}

  static join(
    project: KnowledgeClient,
    home: KnowledgeClient,
    release: () => Promise<void> = async () => undefined,
    pending?: KnowledgePendingReader,
  ): ScopedKnowledgeHub {
    return new ScopedKnowledgeHub(project, home, release, pending);
  }

  static async open(
    project: string,
    home: string,
    settings: KnowledgeSettingsInput = {},
    observe?: KnowledgeStageObserver,
    meaning?: KnowledgeMeaning,
  ): Promise<ScopedKnowledgeHub> {
    const first = await KnowledgeHub.open(projectHubHome(project), settings, observe, meaning);
    try {
      const second = await KnowledgeHub.open(home, settings, observe, meaning);
      return new ScopedKnowledgeHub(
        first,
        second,
        async () => {
          try {
            await first.close();
          } finally {
            await second.close();
          }
        },
        (scope, query) =>
          inspectPendingKnowledge(
            scope === KnowledgeScope.Project ? projectHubHome(project) : home,
            query,
            settings,
          ),
      );
    } catch (error) {
      await first.close();
      throw error;
    }
  }

  hub(scope: KnowledgeScope): KnowledgeClient {
    return scope === KnowledgeScope.Project ? this.project : this.home;
  }

  close(): Promise<void> {
    return this.release();
  }

  async get(id: string): Promise<ScopedKnowledgeEntryResult> {
    try {
      return { ...(await this.project.get(id)), scope: KnowledgeScope.Project };
    } catch (error) {
      if (!(error instanceof TitanError) || error.code !== ErrorCode.KnowledgeMissing) throw error;
      return { ...(await this.home.get(id)), scope: KnowledgeScope.Home };
    }
  }

  async promote(id: string) {
    const { entry } = await this.project.get(id);
    try {
      await this.home.get(id);
    } catch (error) {
      if (!(error instanceof TitanError) || error.code !== ErrorCode.KnowledgeMissing) throw error;
      const source = `${KnowledgePromote.SourceTag}${KnowledgeScope.Project}`;
      return this.home.add({
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        body: entry.body,
        tags: entry.tags.includes(source) ? entry.tags : [...entry.tags, source],
      });
    }
    throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.PromoteExists);
  }

  async search(input: unknown): Promise<ScopedKnowledgeSearchPage> {
    const home = await this.home.search(input);
    const project = await this.project.search(input);
    const seen = new Set(project.results.map((result) => result.id));
    const fromHome = home.results.filter((result) => !seen.has(result.id));
    const merged = [
      ...project.results.map((result) => ({ ...result, scope: KnowledgeScope.Project })),
      ...fromHome.map((result) => ({ ...result, scope: KnowledgeScope.Home })),
    ];
    const bounded = limitSearchRows(merged, project.query.limit);
    return ScopedKnowledgeSearchPageSchema.parse({
      ...project,
      actual_mode:
        project.actual_mode === home.actual_mode ? project.actual_mode : KnowledgeSearchMode.Words,
      warning: project.warning ?? home.warning,
      truncated: project.truncated || home.truncated || bounded.truncated,
      results: bounded.results,
    });
  }

  async list(input: ScopedKnowledgeListInput = {}): Promise<ScopedKnowledgeListResult> {
    const query = ScopedKnowledgeListSchema.parse(input);
    const kinds = query.kind ? [query.kind] : Object.values(KnowledgeKind);
    const entries = new Map<string, ScopedKnowledgeListEntry>();
    let truncated = false;
    const scopes = query.scope ? [query.scope] : Object.values(KnowledgeScope);
    const states = query.state ?? KnowledgeState.Final;
    for (const scope of scopes) {
      if (states === KnowledgeState.Pending) {
        if (!this.pending)
          throw new TitanError(ErrorCode.NotBuilt, KnowledgeMessage.PendingInspectionUnavailable);
        const page = await this.pending(scope, query);
        truncated ||= page.truncated;
        for (const entry of page.entries)
          entries.set(JSON.stringify([scope, entry.attempt, entry.id]), {
            ...entry,
            scope,
            state: KnowledgeState.Pending,
          });
      }
      for (const kind of states === KnowledgeState.Final ? kinds : []) {
        const page = await this.hub(scope).search({
          kind,
          mode: KnowledgeSearchMode.Words,
          limit: query.limit,
        });
        truncated ||= page.truncated;
        for (const row of page.results)
          if (!entries.has(row.id) && (!query.tag || row.tags.includes(query.tag)))
            entries.set(row.id, {
              id: row.id,
              kind: row.kind,
              title: row.title,
              version: row.version,
              tags: row.tags,
              scope,
              state: KnowledgeState.Final,
            });
      }
    }
    const rows = [...entries.values()];
    return {
      entries: rows.slice(0, query.limit),
      truncated: truncated || rows.length > query.limit,
    };
  }

  async stats(only?: KnowledgeScope): Promise<ScopedKnowledgeStats> {
    const scopes = [];
    for (const scope of only ? [only] : Object.values(KnowledgeScope))
      scopes.push({ ...(await this.hub(scope).stats()), scope });
    return {
      scopes,
      meaning_ready: scopes.every((row) => row.meaning_ready),
    };
  }

  async show(
    id: string,
    scope?: KnowledgeScope,
    history: KnowledgeHistoryWindow = {},
  ): Promise<ScopedKnowledgeShow> {
    const found =
      scope === undefined ? await this.get(id) : { ...(await this.hub(scope).get(id)), scope };
    const other =
      found.scope === KnowledgeScope.Project ? KnowledgeScope.Home : KnowledgeScope.Project;
    const links: KnowledgeLink[] = [];
    const copy = await this.peek(other, id);
    if (copy)
      links.push({
        id,
        kind: copy.kind,
        title: copy.title,
        scope: other,
        relation: KnowledgeRelation.Copy,
      });
    const mentioned = new Set(found.entry.body.match(KnowledgePattern.EntryId) ?? []);
    mentioned.delete(id);
    for (const target of mentioned) {
      const hit = await this.peek(KnowledgeScope.Project, target);
      const scope = hit ? KnowledgeScope.Project : KnowledgeScope.Home;
      const row = hit ?? (await this.peek(KnowledgeScope.Home, target));
      if (row)
        links.push({
          id: target,
          kind: row.kind,
          title: row.title,
          scope,
          relation: KnowledgeRelation.Mentions,
        });
    }
    const source = found.entry.tags
      .find((tag) => tag.startsWith(KnowledgePromote.SourceTag))
      ?.slice(KnowledgePromote.SourceTag.length);
    const promoted = KnowledgeScopeSchema.safeParse(source);
    return ScopedKnowledgeShowSchema.parse({
      ...found,
      history: {
        page: await this.hub(found.scope).history({ ...history, id }),
        version: found.entry.version,
        earlier_versions: found.entry.version - 1,
        promoted_from: promoted.success ? promoted.data : null,
      },
      links,
    });
  }

  private async peek(scope: KnowledgeScope, id: string) {
    try {
      return (await this.hub(scope).get(id)).entry;
    } catch (error) {
      if (!(error instanceof TitanError) || error.code !== ErrorCode.KnowledgeMissing) throw error;
      return undefined;
    }
  }
}
