// Probe: a titan server that runs a hive from an append-only board file.
// The board file is the truth. The state in memory is rebuilt from it at start.
// Usage: bun server.ts <board file> <port file> <token>
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

type Ev = { seq: number; kind: string; [k: string]: any };
const [boardPath, portFile, token] = process.argv.slice(2);
// Control runs: NO_VERSION_CHECK=1 turns off the version check; a board path of /dev/null keeps the state in memory only.

// ---- the board: one JSON line per event, added in one write ----
let events: Ev[] = existsSync(boardPath)
  ? readFileSync(boardPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
const listeners = new Set<(e: Ev) => void>();
function emit(kind: string, body: Record<string, any>): Ev {
  const e: Ev = { seq: events.length + 1, time: new Date().toISOString(), kind, ...body };
  appendFileSync(boardPath, JSON.stringify(e) + "\n");
  events.push(e);
  apply(e);
  for (const l of listeners) l(e);
  return e;
}

// ---- state, folded from the events ----
type Step = { id: string; by: string; agent: string; state: "waiting" | "ready" | "running" | "done" | "denied"; result?: string };
type Req = { id: string; from: string; to: "main" | "human"; kind: string; step?: string; state: "open" | "answered"; decision?: string; version: number };
let policy: Record<string, "auto" | "main" | "human"> = {};
let maxSteps = 10;
const steps = new Map<string, Step>();
const reqs = new Map<string, Req>();
function apply(e: Ev) {
  if (e.kind === "hive_started") { policy = e.policy; maxSteps = e.max_steps; }
  if (e.kind === "step_added") steps.set(e.step, { id: e.step, by: e.by, agent: e.agent, state: e.needs_approval ? "waiting" : "ready" });
  if (e.kind === "step_started") steps.get(e.step)!.state = "running";
  if (e.kind === "step_done") { const s = steps.get(e.step)!; s.state = "done"; s.result = e.result; }
  if (e.kind === "request") reqs.set(e.request, { id: e.request, from: e.from, to: e.to, kind: e.req_kind, step: e.step, state: "open", version: 1 });
  if (e.kind === "answer") {
    const r = reqs.get(e.request)!; r.state = "answered"; r.decision = e.decision; r.version++;
    if (r.step) steps.get(r.step)!.state = e.decision === "yes" ? "ready" : "denied";
  }
}
for (const e of events) apply(e);
// A step that was running when the server stopped runs again (at least once).
for (const s of steps.values()) if (s.state === "running") { s.state = "ready"; }

// ---- fake agents: each returns a result and may add steps ----
const agents: Record<string, (step: Step) => { result: string; add?: { agent: string; kind: string }[] }> = {
  planner: () => ({ result: "plan: write code, test it, deploy it", add: [{ agent: "coder", kind: "step" }, { agent: "tester", kind: "step" }, { agent: "deployer", kind: "deploy" }] }),
  coder: () => ({ result: "code written" }),
  tester: () => ({ result: "tests pass" }),
  deployer: () => ({ result: "deployed" }),
  runaway: () => ({ result: "I need many helpers", add: Array.from({ length: 50 }, () => ({ agent: "coder", kind: "step" })) }),
};

function addStep(by: string, agent: string, kind: string) {
  const level = policy[kind] ?? "main";
  if (steps.size >= maxSteps) {
    const id = `r${reqs.size + 1}`;
    if (![...reqs.values()].some((r) => r.kind === "raise_step_limit" && r.state === "open"))
      emit("request", { request: id, from: by, to: "main", req_kind: "raise_step_limit" });
    emit("refused", { by, agent, reason: `step limit ${maxSteps} reached` });
    return;
  }
  const id = `s${steps.size + 1}`;
  emit("step_added", { step: id, by, agent, needs_approval: level !== "auto" });
  if (level !== "auto") emit("request", { request: `r${reqs.size + 1}`, from: by, to: level, req_kind: `approve_${kind}`, step: id });
}

let running = 0;
function tick() {
  for (const s of steps.values()) {
    if (s.state !== "ready" || running >= 4) continue;
    running++;
    emit("step_started", { step: s.id });
    setTimeout(() => {
      const out = agents[s.agent](s);
      emit("step_done", { step: s.id, result: out.result });
      for (const a of out.add ?? []) addStep(s.id, a.agent, a.kind);
      running--;
      tick();
    }, 30);
  }
}

// ---- HTTP API on 127.0.0.1 only, with a token and an Origin check ----
const json = (b: any, status = 200) => Response.json(b, { status });
function guard(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return json({ error: "origin not allowed" }, 403);
  if (req.headers.get("authorization") !== `Bearer ${token}`) return json({ error: "missing or wrong token" }, 401);
  return null;
}
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 0,
  routes: {
    "/hive": {
      POST: async (req) => guard(req) ?? (async () => {
        const b = await req.json();
        if (events.length) return json({ error: "hive already started" }, 409);
        emit("hive_started", { goal: b.goal, policy: b.policy, max_steps: b.max_steps });
        addStep("main", b.first_agent, "step");
        tick();
        return json({ ok: true });
      })(),
      GET: (req) => guard(req) ?? json({ steps: [...steps.values()], requests: [...reqs.values()], events: events.length }),
    },
    "/hive/requests/:id/answer": {
      POST: async (req) => guard(req) ?? (async () => {
        const r = reqs.get(req.params.id);
        const b = await req.json();
        if (!r) return json({ error: "no such request" }, 404);
        // Optimistic version check: the answer names the version it saw.
        if (!process.env.NO_VERSION_CHECK && (r.state !== "open" || r.version !== b.version)) return json({ error: "request already answered", version: r.version }, 409);
        if (r.to === "human" && b.by !== "human") return json({ error: `request ${r.id} needs a human` }, 403);
        emit("answer", { request: r.id, decision: b.decision, by: b.by });
        tick();
        return json({ ok: true });
      })(),
    },
    "/hive/events": {
      GET: (req) => guard(req) ?? (() => {
        // Server-sent events. A client that reconnects sends Last-Event-ID.
        const after = Number(req.headers.get("last-event-id") ?? 0);
        let send: (e: Ev) => void;
        const stream = new ReadableStream({
          start(c) {
            send = (e) => c.enqueue(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
            for (const e of events) if (e.seq > after) send(e);
            listeners.add(send);
          },
          cancel() { listeners.delete(send); },
        });
        return new Response(stream, { headers: { "content-type": "text/event-stream" } });
      })(),
    },
  },
});
tick();
writeFileSync(portFile, String(server.port));
