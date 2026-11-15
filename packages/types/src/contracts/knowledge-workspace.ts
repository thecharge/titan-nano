import type { KnowledgeEntryResult, KnowledgeSearchPage } from "../knowledge.ts";
import type { KnowledgeAttemptScope } from "../knowledge-attempts.ts";
import type { KnowledgeViewDeletion, KnowledgeViewEntry } from "../knowledge-view.ts";
import type { KnowledgeViewSearchPage } from "../knowledge-view-search.ts";
import type { NativeToolScope } from "../native-tools.ts";
import type { PersonaBinding } from "../persona-lifecycle.ts";
import type { RunHub } from "../run-hub.ts";
import type { Workflow } from "../workflow.ts";
import type { KnowledgeClient } from "./knowledge.ts";
import type { KnowledgeAttemptOwner } from "./knowledge-attempts.ts";
import type { OpenCallResolver, PersonaDecisionWriter, PersonaHistoryWriter } from "./runner.ts";

export interface KnowledgePrivateView {
  get(id: string): Promise<KnowledgeViewEntry>;
  search(input: unknown): Promise<KnowledgeViewSearchPage>;
  add(input: unknown): Promise<KnowledgeViewEntry>;
  update(input: unknown): Promise<KnowledgeViewEntry>;
  delete(input: unknown): Promise<KnowledgeViewDeletion>;
}
export interface KnowledgeNativeHub {
  get(id: string): Promise<KnowledgeEntryResult>;
  search(input: unknown): Promise<KnowledgeSearchPage>;
  view(scope: KnowledgeAttemptScope): KnowledgePrivateView;
}
export interface KnowledgeWorkspaceClient extends KnowledgeClient, KnowledgeNativeHub {
  attempts: KnowledgeAttemptOwner;
}
export type KnowledgeWorkspaceOperation = <T>(
  project: string,
  action: (local: KnowledgeWorkspaceClient, home: KnowledgeWorkspaceClient) => Promise<T>,
) => Promise<T>;
export type NativeKnowledgeRouter = <T>(
  scope: NativeToolScope,
  action: (hub: KnowledgeNativeHub) => Promise<T>,
) => Promise<T>;
export interface OwnedKnowledge {
  hub: RunHub;
  attempts: KnowledgeAttemptOwner;
  use: KnowledgeWorkspaceOperation;
  bindPersonas(workflow: Workflow): Promise<PersonaBinding>;
  resolvePersonas(workflow: Workflow): Promise<Workflow>;
  personaHistory: PersonaHistoryWriter;
  personaDecision: PersonaDecisionWriter;
  openCalls: OpenCallResolver;
}
