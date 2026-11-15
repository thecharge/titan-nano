// Tries to break the hive server probe. Usage: bun test.ts
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "hive-"));
const token = "t-" + Math.random().toString(36).slice(2);
const results: string[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
  console.log(results.at(-1));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function start(board: string) {
  const portFile = join(dir, "port-" + Math.random());
  const p = Bun.spawn(["bun", join(import.meta.dir, "server.ts"), board, portFile, token], { stdout: "inherit", stderr: "inherit" });
  while (!existsSync(portFile)) await sleep(10);
  await sleep(20);
  const base = `http://127.0.0.1:${readFileSync(portFile, "utf8")}`;
  const call = (path: string, init: RequestInit = {}, headers: Record<string, string> = {}) =>
    fetch(base + path, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...headers } });
  return { p, base, call };
}
async function until(call: any, f: (s: any) => boolean, ms = 3000) {
  const t = Date.now();
  while (Date.now() - t < ms) { const s = await (await call("/hive")).json(); if (f(s)) return s; await sleep(20); }
  return (await call("/hive")).json();
}

// 1. Agents add steps while the hive runs; a deploy step waits for a human.
const board = join(dir, "board.jsonl");
let s = await start(board);
await s.call("/hive", { method: "POST", body: JSON.stringify({ goal: "ship a feature", first_agent: "planner", max_steps: 10, policy: { step: "auto", deploy: "human" } }) });
let st = await until(s.call, (x) => x.steps.filter((y: any) => y.state === "done").length === 3);
const deploy = st.steps.find((y: any) => y.agent === "deployer");
check("agents add steps", st.steps.length === 4 && st.steps.slice(1).every((y: any) => y.by === "s1"), `${st.steps.length} steps, steps 2-4 added by s1 (the planner)`);
check("other steps run while one waits", deploy.state === "waiting" && st.steps.filter((y: any) => y.state === "done").length === 3, `coder and tester done, deploy is "${deploy.state}"`);
const req = st.requests[0];
check("request goes to the human", req.to === "human" && req.kind === "approve_deploy", `request ${req.id} to ${req.to}, kind ${req.kind}`);

// 2. The main agent may not answer a request that needs a human.
let r = await s.call(`/hive/requests/${req.id}/answer`, { method: "POST", body: JSON.stringify({ decision: "yes", by: "main", version: 1 }) });
check("main agent cannot answer for the human", r.status === 403, `status ${r.status}`);

// 3. The server is killed while it waits; a new server rebuilds the state from the board.
const before = JSON.stringify((await (await s.call("/hive")).json()).steps);
s.p.kill(9); await s.p.exited;
s = await start(board);
const after = JSON.stringify((await (await s.call("/hive")).json()).steps);
check("state survives a crash", before === after, `steps after restart ${after === before ? "equal" : "differ"} (${readFileSync(board, "utf8").trim().split("\n").length} board lines)`);

// 4. Two answers at the same time: only one may win.
const [a, b] = await Promise.all([1, 2].map(() => s.call(`/hive/requests/${req.id}/answer`, { method: "POST", body: JSON.stringify({ decision: "yes", by: "human", version: 1 }) })));
check("two answers at once", [a.status, b.status].sort().join(",") === "200,409", `statuses ${a.status} and ${b.status}`);
st = await until(s.call, (x) => x.steps.every((y: any) => y.state === "done"));
check("approved step runs", st.steps.every((y: any) => y.state === "done"), `all ${st.steps.length} steps done`);

// 5. Live events: read some, disconnect, reconnect with Last-Event-ID, and check for gaps.
async function readEvents(lastId: number, n: number) {
  const res = await s.call("/hive/events", {}, lastId ? { "last-event-id": String(lastId) } : {});
  const rd = res.body!.getReader(); const seqs: number[] = []; let buf = "";
  while (seqs.length < n) {
    const { value, done } = await rd.read(); if (done) break;
    buf += new TextDecoder().decode(value);
    for (const m of buf.matchAll(/^id: (\d+)$/gm)) if (!seqs.includes(+m[1])) seqs.push(+m[1]);
  }
  await rd.cancel();
  return seqs.slice(0, n);
}
const total = readFileSync(board, "utf8").trim().split("\n").length;
const first = await readEvents(0, 5);
const rest = await readEvents(first.at(-1)!, total - 5);
const all = [...first, ...rest];
check("events resume without gaps", all.length === total && all.every((v, i) => v === i + 1), `${all.length} of ${total} events, in order, no duplicates`);

// 6. Calls without the token, or from a web page on another site, are refused.
r = await fetch(s.base + "/hive");
check("no token", r.status === 401, `status ${r.status}`);
r = await s.call("/hive", {}, { origin: "https://evil.example" });
check("foreign web page", r.status === 403, `status ${r.status}`);
s.p.kill(); await s.p.exited;

// 7. A runaway agent tries to add 50 steps; the hive stops at its step limit and asks the main agent.
const board2 = join(dir, "board2.jsonl");
s = await start(board2);
await s.call("/hive", { method: "POST", body: JSON.stringify({ goal: "runaway", first_agent: "runaway", max_steps: 10, policy: { step: "auto" } }) });
st = await until(s.call, (x) => x.steps.length === 10 && x.steps.every((y: any) => y.state === "done"));
const lines = readFileSync(board2, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const refused = lines.filter((l) => l.kind === "refused").length;
const asks = lines.filter((l) => l.kind === "request" && l.req_kind === "raise_step_limit").length;
check("runaway agent is stopped", st.steps.length === 10 && refused === 41 && asks === 1, `${st.steps.length} steps, ${refused} refused, ${asks} request to the main agent to raise the limit`);
s.p.kill(); await s.p.exited;

rmSync(dir, { recursive: true });
console.log(`${results.filter((x) => x.startsWith("PASS")).length} passed, ${results.filter((x) => x.startsWith("FAIL")).length} failed`);
