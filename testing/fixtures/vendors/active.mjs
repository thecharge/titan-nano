import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stateFile } from "./state.mjs";

export async function activeTurn(cwd, turn) {
  if (turn > 1) {
    if ((await readFile(join(cwd, "DELIVERED.txt"), "utf8")) !== "Partial native delivery")
      throw new Error("Interrupted workspace was not preserved");
    return;
  }
  await writeFile(join(cwd, "DELIVERED.txt"), "Partial native delivery");
  const child = Bun.spawn([process.execPath, import.meta.path, cwd], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await writeFile(
    await stateFile(cwd, "active-pids.json"),
    JSON.stringify({ vendor: process.pid, descendant: child.pid }),
  );
  await child.exited;
  throw new Error("Active fixture must be interrupted");
}
if (import.meta.main) {
  const cwd = process.argv[2];
  const heartbeat = await stateFile(cwd, "writer-heartbeat");
  for (let tick = 1; tick <= 3000; tick++) {
    await writeFile(heartbeat, String(tick));
    await Bun.sleep(10);
  }
}
