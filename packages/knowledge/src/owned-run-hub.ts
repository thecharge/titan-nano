import { resolve } from "node:path";
import { RunHubTools } from "@titan/constants";
import { KeyedQueue } from "@titan/store";
import type { KnowledgeSettingsInput, OwnedKnowledge, RunHub } from "@titan/types";
import { KnowledgeHub } from "./hub.ts";
import { selectKnowledgeAttempt } from "./native-run-knowledge.ts";
import { scopedRunHub } from "./run-hub.ts";
import { projectHubHome, ScopedKnowledgeHub } from "./scoped.ts";

export function ownedKnowledge(
  home: string,
  settings: KnowledgeSettingsInput,
  pending: number,
  shared?: KnowledgeHub,
): OwnedKnowledge {
  const queue = new KeyedQueue(pending);
  async function use<T>(
    project: string | undefined,
    action: (local: KnowledgeHub, home: KnowledgeHub) => Promise<T>,
  ): Promise<T> {
    const directory = project === undefined ? resolve(home) : resolve(projectHubHome(project));
    return queue.use(shared ? directory : resolve(home), async () => {
      await using resources = new AsyncDisposableStack();
      const knowledge = shared ?? (await KnowledgeHub.open(home, settings));
      if (!shared) resources.defer(() => knowledge.close());
      const local =
        directory === resolve(home) ? knowledge : await KnowledgeHub.open(directory, settings);
      try {
        return await action(local, knowledge);
      } finally {
        if (local !== knowledge) await local.close();
      }
    });
  }
  const hub: RunHub = {
    tools: () => RunHubTools.Worker,
    read: (goal, project) =>
      use(project, (local, knowledge) =>
        scopedRunHub(ScopedKnowledgeHub.join(local, knowledge), RunHubTools.Worker).read(
          goal,
          project,
        ),
      ),
    keep: (lesson, project) =>
      use(project, (local, knowledge) =>
        scopedRunHub(ScopedKnowledgeHub.join(local, knowledge), RunHubTools.Worker).keep(
          lesson,
          project,
        ),
      ),
    journal: (journal) =>
      use(journal.project, (local, knowledge) =>
        scopedRunHub(ScopedKnowledgeHub.join(local, knowledge), RunHubTools.Worker).journal(
          journal,
        ),
      ),
  };
  return {
    hub,
    use,
    bindPersonas: (workflow) =>
      use(undefined, (_local, knowledge) => knowledge.bindPersonas(workflow)),
    resolvePersonas: (workflow) =>
      use(undefined, (_local, knowledge) => knowledge.resolvePersonas(workflow)),
    personaHistory: (run, events, request, usage) =>
      use(undefined, (_local, knowledge) =>
        knowledge.recordPersonaHistory(run, events, request, usage),
      ),
    personaDecision: (request, stage) =>
      use(undefined, (_local, knowledge) => knowledge.personaDecision(request, stage)),
    openCalls: (tags, excluded) =>
      use(undefined, (_local, knowledge) => knowledge.openCall(tags, excluded)),
    attempts: {
      read: (scope, project) =>
        use(project, async (local, knowledge) =>
          (await selectKnowledgeAttempt(local, knowledge, scope)).attempts.read(scope),
        ),
      publish: (scope, revision, project) =>
        use(project, async (local, knowledge) =>
          (await selectKnowledgeAttempt(local, knowledge, scope)).attempts.publish(scope, revision),
        ),
      discard: (scope, revision, project) =>
        use(project, async (local, knowledge) =>
          (await selectKnowledgeAttempt(local, knowledge, scope)).attempts.discard(scope, revision),
        ),
    },
  };
}

export function ownedRunHub(
  home: string,
  settings: KnowledgeSettingsInput,
  pending: number,
  shared?: KnowledgeHub,
): RunHub {
  return ownedKnowledge(home, settings, pending, shared).hub;
}
