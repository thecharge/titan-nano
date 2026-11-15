import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createRunClient } from "@titan/server/client";
import type { DirectoryAction, RunClientAction, TestHttpResponse } from "@titan/types";

export async function withClientAddress<T>(
  response: TestHttpResponse,
  action: DirectoryAction<T>,
): Promise<T> {
  const home = await mkdtemp(resolve(tmpdir(), "titan-client-response-"));
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => (response instanceof Response ? response.clone() : response(request)),
  });
  await writeFile(
    resolve(home, "server.json"),
    JSON.stringify({
      url: `http://127.0.0.1:${server.port}`,
      token: "x".repeat(64),
      pid: process.pid,
    }),
  );
  try {
    return await action(home);
  } finally {
    await server.stop(true);
    await rm(home, { recursive: true, force: true });
  }
}

export async function withClientResponse<T>(
  response: Response,
  action: RunClientAction<T>,
): Promise<T> {
  return withClientAddress(response, async (home) => action(createRunClient(home)));
}
