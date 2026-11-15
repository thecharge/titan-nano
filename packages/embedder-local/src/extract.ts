import type * as Transformers from "@huggingface/transformers";
import { ErrorCode, LocalEmbedder, VendorPackage } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import type {
  EmbedderExtract,
  TransformersExtractor,
  TransformersModule,
  TransformersPipelineOptions,
} from "@titan/types";

export async function unavailableExtract(): Promise<ArrayLike<number>> {
  throw new TitanError(ErrorCode.NotBuilt, KnowledgeMessage.EmbedderModelUnavailable);
}

export async function loadTransformers(name: string): Promise<TransformersModule> {
  const module: typeof Transformers = await import(name);
  return module as unknown as TransformersModule;
}

export function createTransformersExtract(
  load: (name: string) => Promise<TransformersModule>,
  options?: TransformersPipelineOptions,
): EmbedderExtract {
  let extractor: Promise<TransformersExtractor> | undefined;
  return async (text, model) => {
    extractor ??= load(VendorPackage.Transformers).then((module) =>
      options
        ? module.pipeline(LocalEmbedder.Task, model, options)
        : module.pipeline(LocalEmbedder.Task, model),
    );
    return (await (await extractor)(text, LocalEmbedder.Options)).data;
  };
}

export const transformersExtract = createTransformersExtract(loadTransformers);
