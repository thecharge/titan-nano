// Prototype of the dashboard that `titan serve` would serve. It reads run records
// from <dir>/runs/<id>/events.jsonl. It never writes to them.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import page from "./index.html";

type Ev = { id: number; t: number; kind: string; step?: string; persona?: string; verdict?: string; proof?: string; tokens_in?: number; tokens_out?: number; cost_usd?: number };

export function readEvents(dir: string, run: string): Ev[] {
	const f = join(dir, "runs", run, "events.jsonl");
	if (!existsSync(f)) return [];
	return readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Telemetry for one run, computed from its events only.
export function summary(run: string, evs: Ev[]) {
	let now = 0, most = 0, tin = 0, tout = 0, cost = 0;
	const verdicts: Record<string, number> = {}, proofs: Record<string, number> = {};
	for (const e of evs) {
		if (e.kind === "agent_started") most = Math.max(most, ++now);
		if (e.kind === "agent_answered") { now--; tin += e.tokens_in ?? 0; tout += e.tokens_out ?? 0; cost += e.cost_usd ?? 0; }
		if (e.kind === "agent_answered" && e.verdict) verdicts[e.verdict] = (verdicts[e.verdict] ?? 0) + 1;
		if (e.kind === "check_done" && e.proof) proofs[e.proof] = (proofs[e.proof] ?? 0) + 1;
	}
	const end = evs.find((e) => e.kind === "run_ended");
	const first = evs[0]?.t ?? 0, last = evs.at(-1)?.t ?? 0;
	return {
		run, status: end ? (end.verdict ?? "ended") : "running", steps: [...new Set(evs.filter((e) => e.step).map((e) => e.step))],
		elapsed_ms: last - first, attempts: evs.filter((e) => e.kind === "agent_started").length, most_agents_at_once: most,
		"gen_ai.usage.input_tokens": tin, "gen_ai.usage.output_tokens": tout, cost_usd: Math.round(cost * 1e4) / 1e4, verdicts, proofs,
	};
}

export function startDashboard(dir: string, port = 0) {
	const code = crypto.randomUUID(); // one-time login code, printed by `titan dashboard`
	let codeUsed = false;
	const sessions = new Set<string>();
	const cookieOf = (r: Request) => /(?:^|;\s*)titan_session=([^;]+)/.exec(r.headers.get("cookie") ?? "")?.[1];
	const server = Bun.serve({
		hostname: "127.0.0.1", port, development: false,
		routes: { "/": page }, // the page holds no run data; every data route below needs the cookie
		async fetch(req, srv) {
			const url = new URL(req.url);
			const origin = req.headers.get("origin");
			if (origin && origin !== url.origin) return new Response("foreign origin", { status: 403 });
			if (url.pathname === "/login") {
				if (codeUsed || url.searchParams.get("code") !== code) return new Response("bad or used code", { status: 403 });
				codeUsed = true;
				const sid = crypto.randomUUID(); sessions.add(sid);
				return new Response(null, { status: 303, headers: { location: "/", "set-cookie": `titan_session=${sid}; HttpOnly; SameSite=Strict; Path=/` } });
			}
			const sid = cookieOf(req);
			if (!sid || !sessions.has(sid)) return new Response("login first", { status: 401 });
			const runsDir = join(dir, "runs");
			if (url.pathname === "/api/runs") {
				const ids = existsSync(runsDir) ? readdirSync(runsDir).filter((d) => statSync(join(runsDir, d)).isDirectory()).sort() : [];
				return Response.json(ids.map((id) => summary(id, readEvents(dir, id))));
			}
			const m = /^\/api\/runs\/([\w.-]+)\/events$/.exec(url.pathname);
			if (m) {
				const run = m[1]!;
				let sentUpTo = Number(req.headers.get("last-event-id") ?? 0);
				srv.timeout(req, 0); // keep the stream open
				let timer: ReturnType<typeof setInterval>;
				const stream = new ReadableStream({
					start(c) {
						const push = () => {
							for (const e of readEvents(dir, run)) if (e.id > sentUpTo) { c.enqueue(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`); sentUpTo = e.id; }
						};
						push(); timer = setInterval(push, 200);
					},
					cancel() { clearInterval(timer); },
				});
				return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
			}
			return new Response("not found", { status: 404 });
		},
	});
	return { server, code, url: `http://127.0.0.1:${server.port}` };
}

if (import.meta.main) {
	const d = startDashboard(process.argv[2] ?? ".", Number(process.argv[3] ?? 0));
	console.log(`open ${d.url}/login?code=${d.code}`);
}
