import { EmbedderName, LocalEmbedder } from "@titan/constants";
import type { Embedder, EmbedderExtract } from "@titan/types";
import { transformersExtract } from "./extract.ts";

export {
  createTransformersExtract,
  loadTransformers,
  transformersExtract,
  unavailableExtract,
} from "./extract.ts";
export { createCachedEmbedder } from "./home-embedder.ts";

export function createLocalEmbedder(extract: EmbedderExtract = transformersExtract): Embedder {
  return {
    name: EmbedderName.Local,
    embed: async (text) => Array.from(await extract(text, LocalEmbedder.Model)),
  };
}
