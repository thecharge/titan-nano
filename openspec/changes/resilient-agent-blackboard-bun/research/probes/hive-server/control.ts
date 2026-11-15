// Control runs: the same attacks with each safeguard turned off. Each one should break.
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "hive-ctl-"));
const token = "t";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function start(board: string, env: Record<string, string> = {}) {
  const pf = join(dir, "port-" + Math.random());
  const p = Bun.spawn(["bun", join(import.meta.dir, "server.ts"), board, pf, token], { env: { ...process.env, ...env } });
  while (!existsSync(pf)) await sleep(10);
  const base = `http://127.0.0.1:${readFileSync(pf, "utf8")}`;
  const call = (path: string, init: RequestInit = {}) => fetch(base + path, { ...init, headers: { authorization: "Bearer t", "content-type": "application/json" } });
  return { p, call };
}
const hive = JSON.stringify({ goal: "ship", first_agent: "planner", max_steps: 10, policy: { step: "auto", deploy: "human" } });

// Control 1: no version check. Two answers at once.
const b1 = join(dir, "b1.jsonl");
let s = await start(b1, { NO_VERSION_CHECK: "1" });
await s.call("/hive", { method: "POST", body: hive }); await sleep(500);
const st = await Promise.all([1, 2].map(() => s.call("/hive/requests/r1/answer", { method: "POST", body: JSON.stringify({ decision: "yes", by: "human", version: 1 }) })));
await sleep(300);
const answers = readFileSync(b1, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((e) => e.kind === "answer").length;
console.log(`CONTROL no version check: statuses ${st.map((r) => r.status).join(" and ")}, ${answers} answer events for one request`);
s.p.kill(); await s.p.exited;

// Control 2: state in memory only. Crash while a step waits.
s = await start("/dev/null");
await s.call("/hive", { method: "POST", body: hive }); await sleep(500);
const before = (await (await s.call("/hive")).json()).steps.length;
s.p.kill(9); await s.p.exited;
s = await start("/dev/null");
const after = (await (await s.call("/hive")).json()).steps.length;
console.log(`CONTROL state in memory only: ${before} steps before the crash, ${after} after`);
s.p.kill(); await s.p.exited;
