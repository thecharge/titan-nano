import { createFakeEmbedder } from "@titan/embedder-fake";

export async function sameVector(first: string, second: string) {
  const embedder = createFakeEmbedder();
  const left = await embedder.embed(first);
  const right = await embedder.embed(second);
  return { equal: left.every((value, index) => value === right[index]), size: left.length };
}
