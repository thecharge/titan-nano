export const LocalModelMessage = {
  FetchFailed: "The meaning-search model download failed; run titan doctor --fetch-model to retry",
  UnsafeCache: "The meaning-search model cache contains an unsafe path",
} as const;

export const modelArtifactFailure = (file: string): string =>
  `Meaning-search model artifact ${file} did not match its pinned size and SHA-256; run titan doctor --fetch-model to retry`;

export const modelFetchNotice = (name: string, bytes: number): string =>
  `Downloading meaning-search model ${name} (${bytes} bytes)`;
