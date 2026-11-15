import type { KnowledgeCommand, KnowledgePublicationStage } from "@titan/constants";
import type {
  KnowledgeChange,
  KnowledgeDeletionResult,
  KnowledgeEntryResult,
  KnowledgeHistoryPage,
  KnowledgeMaintenanceResult,
  KnowledgeReadResult,
  KnowledgeReindexResult,
  KnowledgeRow,
  KnowledgeSearchPage,
  KnowledgeStats,
} from "../knowledge.ts";

export type KnowledgeStageObserver = (stage: KnowledgePublicationStage) => Promise<void>;
export interface KnowledgeClient {
  add(input: unknown): Promise<KnowledgeEntryResult>;
  get(id: string): Promise<KnowledgeEntryResult>;
  history(input: unknown): Promise<KnowledgeHistoryPage>;
  update(input: unknown): Promise<KnowledgeEntryResult>;
  delete(input: unknown): Promise<KnowledgeDeletionResult>;
  search(input: unknown): Promise<KnowledgeSearchPage>;
  reindex(): Promise<KnowledgeReindexResult>;
  stats(): Promise<KnowledgeStats>;
  maintenance(
    operation: KnowledgeCommand.Prune | KnowledgeCommand.Consolidate,
    input: unknown,
  ): Promise<KnowledgeMaintenanceResult>;
  restore(id: string): Promise<KnowledgeEntryResult>;
}

export type KnowledgeReader = (id: string) => Promise<KnowledgeReadResult>;

export interface PersonaReadStorage {
  read: KnowledgeReader;
  readArchived?: (id: string) => Promise<KnowledgeReadResult | undefined>;
}

export interface PersonaRegistryStorage extends PersonaReadStorage {
  publish(change: KnowledgeChange): Promise<void>;
}

export interface PersonaQualityStorage extends PersonaRegistryStorage {
  rows(): AsyncIterable<KnowledgeRow>;
  publishMany(publication: string, changes: readonly KnowledgeChange[]): Promise<void>;
}

export type KnowledgeRows = Iterable<KnowledgeRow> | AsyncIterable<KnowledgeRow>;
