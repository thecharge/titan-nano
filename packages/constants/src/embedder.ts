export const FakeEmbedder = {
  Name: "@titan/embedder-fake",
  Dimension: 8,
  Digest: "sha256",
  ByteRange: 255,
} as const;

export const EmbedderName = {
  Local: "@titan/embedder-local",
} as const;

export const LocalEmbedder = {
  Model: "Xenova/all-MiniLM-L6-v2",
  Task: "feature-extraction",
  Options: { pooling: "mean", normalize: true },
  Dimension: 384,
} as const;

export const EmbedderGate = {
  Variable: "TITAN_EMBEDDER_MODEL",
  Value: "1",
  TimeoutMilliseconds: 300000,
} as const;

export const EmbedderFixture = {
  Title: "Backups",
  Body: "run the nightly backup job",
  Words: "backup",
  Garbage: "not a database",
  Missing: "@titan/does-not-exist",
  Vector: [0.5, 0.25],
  Other: "@vendor/embedder-other",
  Question: "the clock is in UTC",
  Advice: "run titan kb reindex",
  Text: "skeptic",
} as const;

export enum VectorIndexSetup {
  Stored = "stored",
  Removed = "removed",
  Garbage = "garbage",
  Oversize = "oversize",
}

export enum VectorHubSetup {
  Ready = "ready",
  Blocked = "blocked",
}

export enum TransformersSetup {
  Fake = "fake",
  Real = "real",
  Missing = "missing",
  Broken = "broken",
}

export const KnowledgeMeta = {
  Value: "value",
  Embedder: "embedder",
} as const;
