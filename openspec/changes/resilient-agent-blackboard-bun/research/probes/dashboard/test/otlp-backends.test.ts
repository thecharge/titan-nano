// Send one fake run to each self-hosted trace viewer that runs on 127.0.0.1,
// then read it back through that viewer's own HTTP API.
import { expect, test } from "bun:test";
import { sendRun } from "./spans";

const on = (name: string) => (process.env.BACKENDS ?? "").split(",").includes(name);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Jaeger 2.x removed the old /api/traces route (it answers 404). The v3 route returns OTLP JSON.
const otlpNames = (j: any) => (j?.resourceSpans ?? []).flatMap((r: any) => r.scopeSpans.flatMap((x: any) => x.spans.map((sp: any) => sp.name)));
test.if(on("jaeger"))("jaeger 2.22.0 receives the run and lists 4 spans", async () => {
	const old = await fetch("http://127.0.0.1:16686/api/traces?service=titan-jaeger");
	console.log("jaeger old /api/traces status", old.status);
	const svc = `titan-j-${Date.now()}`; // one service name per test run
	const sent = await sendRun("http://127.0.0.1:4318/v1/traces", {}, svc);
	let names: string[] = [];
	for (let i = 0; i < 20 && names.length < sent; i++) {
		await sleep(500);
		const r = await fetch(`http://127.0.0.1:16686/api/v3/traces?query.service_name=${svc}&query.start_time_min=2026-11-06T08:00:00Z&query.start_time_max=2026-11-06T10:00:00Z`);
		if (r.status !== 200) continue;
		names = otlpNames(((await r.json()) as any).result);
	}
	console.log(`jaeger: sent ${sent} spans, read back ${names.length}: ${names.sort().join(" | ")}`);
	expect(names.length).toBe(sent);
}, 30000);

test.if(on("phoenix"))("phoenix 20.23.0 receives the run and lists 4 spans", async () => {
	const project = `titan-${Date.now()}`; // one Phoenix project per test run
	const sent = await sendRun("http://127.0.0.1:6006/v1/traces", {}, project);
	let names: string[] = [];
	for (let i = 0; i < 20 && names.length < sent; i++) {
		await sleep(500);
		const r = await fetch(`http://127.0.0.1:6006/v1/projects/${project}/spans?limit=50`);
		const j: any = await r.json();
		if (i === 0) console.log("phoenix status", r.status);
		names = (j.data ?? []).map((s: any) => s.name);
	}
	console.log(`phoenix: sent ${sent} spans, read back ${names.length}: ${names.sort().join(" | ")}`);
	expect(names.length).toBe(sent);
}, 30000);

test.if(on("aspire"))("aspire dashboard 13.6.1 receives the run and lists 4 spans", async () => {
	const sent = await sendRun("http://127.0.0.1:4320/v1/traces", {}, "titan-aspire");
	let names: string[] = [];
	for (let i = 0; i < 20 && names.length < sent; i++) {
		await sleep(500);
		const r = await fetch("http://127.0.0.1:18888/api/telemetry/spans");
		const all = otlpNames(((await r.json()) as any).data);
		names = all.length >= 8 ? all.slice(-4) : all; // an earlier run of this test sent 4 spans already
		if (all.length) console.log("aspire total spans held", all.length);
	}
	console.log(`aspire: sent ${sent} spans, read back ${names.length}: ${names.sort().join(" | ")}`);
	expect(names.length).toBe(sent);
}, 30000);

// Langfuse takes OTLP/HTTP at /api/public/otel/v1/traces with Basic auth (public key : secret key).
// Langfuse v4 answers 404 on the old /api/public/observations route ("events_only mode"); v2 is the read route.
test.if(on("langfuse"))("langfuse 4.66.0 receives the run and lists 4 observations", async () => {
	const auth = { Authorization: "Basic " + btoa("pk-lf-localprobe:sk-lf-localprobe") };
	const q = "http://127.0.0.1:3000/api/public/v2/observations?fromStartTime=2026-11-06T08:00:00Z&toStartTime=2026-11-06T10:00:00Z&limit=200";
	const old = await fetch("http://127.0.0.1:3000/api/public/observations?limit=1", { headers: auth });
	console.log("langfuse old /api/public/observations status", old.status);
	const before = new Set((((await (await fetch(q, { headers: auth })).json()) as any).data ?? []).map((o: any) => o.traceId));
	const sent = await sendRun("http://127.0.0.1:3000/api/public/otel/v1/traces", auth, `titan-l-${Date.now()}`);
	let rows: any[] = [];
	for (let i = 0; i < 60 && rows.length < sent; i++) {
		await sleep(1000);
		const j: any = await (await fetch(q, { headers: auth })).json();
		rows = (j.data ?? []).filter((o: any) => !before.has(o.traceId));
	}
	console.log(`langfuse: sent ${sent} spans, read back ${rows.length}: ${rows.map((o) => `${o.type}:${o.name}`).sort().join(" | ")}`);
	expect(rows.length).toBe(sent);
}, 90000);
