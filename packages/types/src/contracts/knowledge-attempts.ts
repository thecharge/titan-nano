import type { KnowledgeAttemptDocument, KnowledgeAttemptScope } from "../knowledge-attempts.ts";

export interface KnowledgeAttemptOwner {
  read(scope: KnowledgeAttemptScope, project?: string): Promise<KnowledgeAttemptDocument | null>;
  publish(
    scope: KnowledgeAttemptScope,
    revision: number,
    project?: string,
  ): Promise<KnowledgeAttemptDocument>;
  discard(
    scope: KnowledgeAttemptScope,
    revision: number,
    project?: string,
  ): Promise<KnowledgeAttemptDocument>;
}

export type KnowledgeAttemptInspection<T> = (
  document: KnowledgeAttemptDocument | null,
) => Promise<T>;
