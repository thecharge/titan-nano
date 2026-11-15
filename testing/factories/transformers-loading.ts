import { EmbedderFixture, LocalEmbedder, TransformersSetup, VendorPackage } from "@titan/constants";
import { createTransformersExtract, loadTransformers } from "@titan/embedder-local";
import { thrownBy } from "@titan/test-framework";
import type { TransformersModule } from "@titan/types";

const empty = { loaded: false, loads: 0, task: "", model: "", vector: [] };

export async function transformersLoading(setup: TransformersSetup) {
  if (setup === TransformersSetup.Missing) {
    const error = await thrownBy(() => loadTransformers(EmbedderFixture.Missing));
    return { ...empty, loaded: error === undefined };
  }
  if (setup === TransformersSetup.Real) {
    const module = await loadTransformers(VendorPackage.Transformers);
    return { ...empty, loaded: module.pipeline instanceof Function };
  }
  const seen = { loads: 0, task: "", model: "" };
  const module: TransformersModule = {
    pipeline: async (task, model) => {
      seen.task = task;
      seen.model = model;
      return async () => ({ data: new Float32Array(EmbedderFixture.Vector) });
    },
  };
  const extract = createTransformersExtract(async (name) => {
    seen.loads += Number(name === VendorPackage.Transformers);
    if (setup === TransformersSetup.Broken) throw new Error(EmbedderFixture.Missing);
    return module;
  });
  const first = await thrownBy(() => extract(EmbedderFixture.Text, LocalEmbedder.Model));
  const second = await thrownBy(() => extract(EmbedderFixture.Text, LocalEmbedder.Model));
  const vector =
    second === undefined
      ? Array.from(await extract(EmbedderFixture.Text, LocalEmbedder.Model))
      : [];
  return { loaded: first === undefined, ...seen, vector };
}
