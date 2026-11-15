import { createHash } from "node:crypto";
import { FakeEmbedder } from "@titan/constants";
import type { Embedder } from "@titan/types";

async function embed(text: string): Promise<number[]> {
  const digest = createHash(FakeEmbedder.Digest).update(text).digest();
  return Array.from(
    digest.subarray(0, FakeEmbedder.Dimension),
    (byte) => byte / FakeEmbedder.ByteRange,
  );
}

export function createFakeEmbedder(): Embedder {
  return { name: FakeEmbedder.Name, embed };
}
