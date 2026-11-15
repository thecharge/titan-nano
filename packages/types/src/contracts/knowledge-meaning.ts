import type {
  KnowledgeVectorHit,
  TransformersExtractorOptions,
  TransformersExtractorResult,
} from "../knowledge-meaning.ts";
import type { TransformersPipelineOptions } from "../local-model.ts";
import type { Embedder } from "./embedder.ts";

export interface KnowledgeVectorIndex {
  replace(id: string, vector: number[]): Promise<void>;
  remove(id: string): Promise<void>;
  nearest(vector: number[], limit: number): Promise<KnowledgeVectorHit[]>;
  close(): Promise<void>;
}

export interface KnowledgeMeaning {
  embedder: Embedder;
  open(): Promise<KnowledgeVectorIndex>;
}

export interface KnowledgeMeaningRuntime {
  embedder: Embedder;
  index: KnowledgeVectorIndex;
}

export type TransformersExtractor = (
  text: string,
  options: TransformersExtractorOptions,
) => Promise<TransformersExtractorResult>;

export interface TransformersModule {
  pipeline(
    task: string,
    model: string,
    options?: TransformersPipelineOptions,
  ): Promise<TransformersExtractor>;
}
