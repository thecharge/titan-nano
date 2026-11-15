import { createCachedEmbedder } from "@titan/embedder-local";
import { LocalModelStore } from "@titan/workspace";

export function createHomeEmbedder(home: string) {
  return createCachedEmbedder(new LocalModelStore(home));
}

export function inspectLocalModel(home: string) {
  return new LocalModelStore(home).inspect();
}

export function fetchLocalModel(home: string) {
  return new LocalModelStore(home).fetch();
}
