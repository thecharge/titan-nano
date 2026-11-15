import { EmbedderName, ErrorCode, LocalModel, TextSymbol } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import type { Embedder, EmbedderExtract, LocalModelCache, TransformersModule } from "@titan/types";
import { createTransformersExtract, loadTransformers } from "./extract.ts";

export function createCachedEmbedder(
  store: LocalModelCache,
  load: (name: string) => Promise<TransformersModule> = loadTransformers,
): Embedder {
  let initialization: Promise<EmbedderExtract> | undefined;
  const initialize = async (): Promise<EmbedderExtract> => {
    if (!(await store.inspect()).ready)
      throw new TitanError(ErrorCode.NotBuilt, KnowledgeMessage.EmbedderModelUnavailable);
    return createTransformersExtract(load, { dtype: LocalModel.Dtype, local_files_only: true });
  };
  return {
    name: `${EmbedderName.Local}${TextSymbol.Colon}${store.revision}`,
    ready: async () => (await store.inspect()).ready,
    async embed(text) {
      const current = initialization ?? initialize();
      initialization = current;
      try {
        const extract = await current;
        return Array.from(await extract(text, store.directory));
      } catch (error) {
        if (initialization === current) initialization = undefined;
        throw error;
      }
    },
  };
}
