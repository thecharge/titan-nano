import { EmbedderFixture, LocalEmbedder } from "@titan/constants";
import { createLocalEmbedder, unavailableExtract } from "@titan/embedder-local";
import { thrownBy } from "@titan/test-framework";

export async function localEmbedding(output: ArrayLike<number> | null) {
  let seen: string | undefined;
  const embedder = createLocalEmbedder(
    output === null
      ? unavailableExtract
      : async (_text, model) => {
          seen = model;
          return output;
        },
  );
  let vector: number[] | null = null;
  const error = await thrownBy(async () => {
    vector = await embedder.embed(EmbedderFixture.Text);
  });
  return {
    name: embedder.name,
    vector,
    model: seen === LocalEmbedder.Model,
    failure: error === undefined ? null : Reflect.get(Object(error), "code"),
  };
}
