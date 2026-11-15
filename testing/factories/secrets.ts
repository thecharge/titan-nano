import { createSecretScanner } from "@titan/config";

export async function scanChunks(chunks: string[]): Promise<boolean> {
  const scanner = createSecretScanner({ TITAN_TEST_TOKEN: "synthetic-secret" });
  for (const chunk of chunks) scanner.accept(Buffer.from(chunk));
  return true;
}
