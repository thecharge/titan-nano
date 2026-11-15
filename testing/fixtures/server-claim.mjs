import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startServer } from "@titan/server";
import { createFakeBackend } from "../support/backend.ts";

const home = process.argv[2];
await writeFile(join(home, "claim-started"), Buffer.from("claim"));
try {
  const server = await startServer(home, () => createFakeBackend());
  await server.stop();
  console.log(JSON.stringify({ ready: true, code: null }));
} catch (error) {
  console.log(JSON.stringify({ ready: false, code: error.code }));
}
