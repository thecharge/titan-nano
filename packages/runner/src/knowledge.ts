import { ErrorCode, ExecutionPhase, RunEventKind, RunFile, StepStatus } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import type {
  KnowledgeAttemptOwner,
  KnowledgeAttemptScope,
  NodeState,
  Run,
  RunCommit,
  Step,
} from "@titan/types";

export function runKnowledgeScope(run: Run, step: Step, state: NodeState): KnowledgeAttemptScope {
  const generation = state.reconciliations?.length ?? 0;
  return {
    run_id: run.run_id,
    step_id: step.id,
    part_id: null,
    candidate_id: generation
      ? `${RunFile.ReconciliationCandidatePrefix}${generation}`
      : ExecutionPhase.Worker,
    attempt: state.attempt,
  };
}

export class RunKnowledge {
  constructor(
    private owner: KnowledgeAttemptOwner | undefined,
    private commit: RunCommit,
  ) {}

  async keep(run: Run, step: Step, state: NodeState): Promise<boolean> {
    if (!this.owner) return true;
    const scope = runKnowledgeScope(run, step, state);
    const document = await this.owner.read(scope, run.project);
    if (!document) return true;
    try {
      await this.owner.publish(scope, document.revision, run.project);
      return true;
    } catch (error) {
      if (!(error instanceof TitanError) || error.code !== ErrorCode.KnowledgeConflict) throw error;
      state.state = StepStatus.Failed;
      state.evidence.push(KnowledgeMessage.PublicationConflict);
      await this.commit(run, RunEventKind.StepFailed, {
        step_id: step.id,
        attempt: state.attempt,
        reason: ErrorCode.KnowledgeConflict,
        publication_id: document.publication_id,
        entries: document.mutations.map((mutation) => ({
          id: mutation.id,
          version: mutation.version,
        })),
      });
      return false;
    }
  }

  async discard(run: Run, step: Step, state: NodeState): Promise<void> {
    if (!this.owner) return;
    const scope = runKnowledgeScope(run, step, state);
    const document = await this.owner.read(scope, run.project);
    if (!document) return;
    const entries = document.mutations.map((mutation) => ({
      id: mutation.id,
      version: mutation.version,
    }));
    const payload = { step_id: step.id, attempt: state.attempt, entries };
    if (entries.length) await this.commit(run, RunEventKind.KnowledgeAdded, payload);
    await this.owner.discard(scope, document.revision, run.project);
    if (entries.length) await this.commit(run, RunEventKind.KnowledgeUndone, payload);
  }
}
