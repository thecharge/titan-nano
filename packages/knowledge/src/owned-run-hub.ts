import { resolve } from "node:path";
import {
  ErrorCode,
  PersonaRule,
  ProjectPersonaPrefix,
  RequestKind,
  RunHubTools,
  WorkflowField,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import { KeyedQueue } from "@titan/store";
import type { KnowledgeSettingsInput, OwnedKnowledge, RunHub, Workflow } from "@titan/types";
import { KnowledgeHub } from "./hub.ts";
import { selectKnowledgeAttempt } from "./native-run-knowledge.ts";
import { scopedRunHub } from "./run-hub.ts";
import { projectHubHome, ScopedKnowledgeHub } from "./scoped.ts";

function usesProjectPersonas(workflow: Workflow): boolean {
  return Object.values(workflow.personas).some(
    (persona) =>
      (WorkflowField.Use in persona && persona.use.startsWith(ProjectPersonaPrefix)) ||
      (WorkflowField.Mutates in persona && persona.mutates.startsWith(ProjectPersonaPrefix)),
  );
}

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
    bindPersonas: (workflow, project, registration) =>
      use(usesProjectPersonas(workflow) ? project : undefined, (local, knowledge) =>
        knowledge.bindPersonas(workflow, registration, local),
      ),
    resolvePersonas: (workflow, project) =>
      use(usesProjectPersonas(workflow) ? project : undefined, (local, knowledge) =>
        knowledge.resolvePersonas(workflow, local),
      ),
    personaHistory: (run, events, request, usage) =>
      use(run.project, (local, knowledge) =>
        knowledge.recordPersonaHistory(run, events, request, usage, local),
      ),
    personaDecision: (request, stage, project) =>
      use(project, (local, knowledge) => {
        if (
          ![
            RequestKind.NewPersona,
            RequestKind.ImprovePersona,
            RequestKind.MergePersonas,
            RequestKind.RetirePersona,
            RequestKind.DeletePersona,
          ].includes(request.kind)
        )
          return knowledge.personaDecision(request, stage);
        const sources = request.scope.resource.split(PersonaRule.TagSeparator);
        const scoped = sources.filter((source) => source.startsWith(ProjectPersonaPrefix));
        if (scoped.length && (scoped.length !== sources.length || !project))
          throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDecision);
        return (scoped.length ? local : knowledge).personaDecision(request, stage);
      }),
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
