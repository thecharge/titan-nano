import {
  ErrorCode,
  KnowledgeAttemptFormat,
  KnowledgeAttemptState,
  KnowledgeSearchMode,
  KnowledgeState,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  type KnowledgeAttemptScope,
  type KnowledgeClient,
  type KnowledgeNativeHub,
  KnowledgeSearchPageSchema,
  KnowledgeViewEntrySchema,
  KnowledgeViewSearchPageSchema,
  type KnowledgeWorkspaceClient,
} from "@titan/types";
import { ScopedKnowledgeHub } from "./scoped.ts";
import { limitSearchRows } from "./search.ts";

export async function selectKnowledgeAttempt(
  local: KnowledgeWorkspaceClient,
  home: KnowledgeWorkspaceClient,
  scope: KnowledgeAttemptScope,
): Promise<KnowledgeWorkspaceClient> {
  if (local === home) return local;
  const legacy = await home.attempts.read(scope);
  if (!legacy) return local;
  if (await local.attempts.read(scope))
    throw new TitanError(ErrorCode.KnowledgeConflict, KnowledgeMessage.Pending);
  return home;
}

class ScopedPrivateKnowledge {
  private view;
  constructor(
    private local: KnowledgeWorkspaceClient,
    private home: KnowledgeClient,
    private scope: KnowledgeAttemptScope,
  ) {
    this.view = local.view(scope);
  }

  async get(id: string) {
    try {
      return await this.view.get(id);
    } catch (error) {
      if (!(error instanceof TitanError) || error.code !== ErrorCode.KnowledgeMissing) throw error;
      const document = await this.local.attempts.read(this.scope);
      const pending =
        document?.state === KnowledgeAttemptState.Open ||
        document?.state === KnowledgeAttemptState.Prepared;
      if (pending && document.mutations.some((mutation) => mutation.id === id)) throw error;
      const final = await this.home.get(id);
      return KnowledgeViewEntrySchema.parse({
        schema_version: KnowledgeAttemptFormat.Version,
        entry: final.entry,
        private_revision: document?.revision ?? null,
        visibility: KnowledgeState.Final,
      });
    }
  }

  async search(input: unknown) {
    const local = await this.view.search(input);
    const home = await this.home.search(input);
    const document = await this.local.attempts.read(this.scope);
    const pending =
      document?.state === KnowledgeAttemptState.Open ||
      document?.state === KnowledgeAttemptState.Prepared;
    const hidden = new Set([
      ...local.results.map((row) => row.id),
      ...(pending ? document.mutations.map((row) => row.id) : []),
    ]);
    const results = [
      ...local.results,
      ...home.results
        .filter((row) => !hidden.has(row.id))
        .map((row) => ({
          ...row,
          visibility: KnowledgeState.Final,
        })),
    ];
    const bounded = limitSearchRows(results, local.query.limit);
    return KnowledgeViewSearchPageSchema.parse({
      ...local,
      actual_mode:
        local.actual_mode === home.actual_mode ? local.actual_mode : KnowledgeSearchMode.Words,
      warning: local.warning ?? home.warning,
      truncated: local.truncated || home.truncated || bounded.truncated,
      results: bounded.results,
    });
  }

  add(input: unknown) {
    return this.view.add(input);
  }
  update(input: unknown) {
    return this.view.update(input);
  }
  delete(input: unknown) {
    return this.view.delete(input);
  }
}

export async function nativeRunKnowledge(
  local: KnowledgeWorkspaceClient,
  home: KnowledgeWorkspaceClient,
  scope: KnowledgeAttemptScope,
): Promise<KnowledgeNativeHub> {
  const target = await selectKnowledgeAttempt(local, home, scope);
  const fallback = target === local ? home : local;
  const scoped = ScopedKnowledgeHub.join(local, home);
  return {
    get: async (id) => {
      const { scope: _scope, ...result } = await scoped.get(id);
      return result;
    },
    search: async (input) => {
      const page = await scoped.search(input);
      return KnowledgeSearchPageSchema.parse({
        ...page,
        results: page.results.map(({ scope: _scope, ...row }) => row),
      });
    },
    view: (attempt) => new ScopedPrivateKnowledge(target, fallback, attempt),
  };
}
