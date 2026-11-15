// The built-in dashboard prototype: login, Origin check, run list with telemetry, live events.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDashboard } from "../dashboard/server";
import { events } from "./fake-run";

const dir = mkdtempSync(join(tmpdir(), "titan-dash-"));
const line = (e: object) => JSON.stringify(e) + "\n";
let d: ReturnType<typeof startDashboard>;
let cookie = "";

beforeAll(() => {
	mkdirSync(join(dir, "runs", "run-past"), { recursive: true });
	writeFileSync(join(dir, "runs", "run-past", "events.jsonl"), events.map(line).join(""));
	mkdirSync(join(dir, "runs", "run-live"), { recursive: true });
	writeFileSync(join(dir, "runs", "run-live", "events.jsonl"), events.slice(0, 3).map(line).join(""));
	d = startDashboard(dir);
});
afterAll(() => d.server.stop(true));

test("data routes answer 401 before login", async () => {
	expect((await fetch(`${d.url}/api/runs`)).status).toBe(401);
});

test("a wrong code is refused; the right code gives an HttpOnly SameSite=Strict cookie once", async () => {
	expect((await fetch(`${d.url}/login?code=wrong`, { redirect: "manual" })).status).toBe(403);
	const ok = await fetch(`${d.url}/login?code=${d.code}`, { redirect: "manual" });
	const set = ok.headers.get("set-cookie") ?? "";
	console.log("login status", ok.status, "set-cookie flags:", set.replace(/=[0-9a-f-]{36}/, "=<id>"));
	expect(ok.status).toBe(303);
	expect(set).toContain("HttpOnly");
	expect(set).toContain("SameSite=Strict");
	cookie = set.split(";")[0]!;
	expect((await fetch(`${d.url}/login?code=${d.code}`, { redirect: "manual" })).status).toBe(403);
});

test("a request from a foreign web page is refused even with the cookie", async () => {
	const r = await fetch(`${d.url}/api/runs`, { headers: { cookie, origin: "http://evil.example" } });
	expect(r.status).toBe(403);
});

test("the run list shows a past run and a running run with telemetry", async () => {
	const runs: any[] = await (await fetch(`${d.url}/api/runs`, { headers: { cookie } })).json();
	console.log(JSON.stringify(runs));
	const past = runs.find((r) => r.run === "run-past"), live = runs.find((r) => r.run === "run-live");
	expect(past.status).toBe("passed");
	expect(past["gen_ai.usage.input_tokens"]).toBe(2100);
	expect(past.cost_usd).toBe(0.03);
	expect(past.proofs).toEqual({ proven: 1 });
	expect(past.verdicts).toEqual({ survived: 1 });
	expect(live.status).toBe("running");
});

test("the live stream sends new events within 1 s and resumes after Last-Event-ID", async () => {
	const res = await fetch(`${d.url}/api/runs/run-live/events`, { headers: { cookie } });
	const reader = res.body!.getReader();
	const dec = new TextDecoder();
	let text = "";
	const readUntil = async (needle: string, ms: number) => {
		const end = Date.now() + ms;
		while (!text.includes(needle) && Date.now() < end) {
			const r = await Promise.race([reader.read(), Bun.sleep(end - Date.now()).then(() => null)]);
			if (r && !r.done) text += dec.decode(r.value);
		}
		return text.includes(needle);
	};
	expect(await readUntil("id: 3", 1000)).toBe(true);
	const t0 = performance.now();
	appendFileSync(join(dir, "runs", "run-live", "events.jsonl"), line(events[3]!));
	expect(await readUntil("id: 4", 1000)).toBe(true);
	console.log(`new event arrived after ${Math.round(performance.now() - t0)} ms`);
	await reader.cancel();
	const again = await fetch(`${d.url}/api/runs/run-live/events`, { headers: { cookie, "last-event-id": "3" } });
	const r2 = again.body!.getReader();
	const first = dec.decode((await r2.read()).value);
	await r2.cancel();
	console.log("after Last-Event-ID 3 the first message is:", first.split("\n")[0]);
	expect(first.startsWith("id: 4")).toBe(true);
});

test("the page is bundled by Bun and loads no script from another host", async () => {
	const html = await (await fetch(`${d.url}/`)).text();
	const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]!);
	console.log("page script sources:", srcs.join(", "));
	expect(srcs.length).toBeGreaterThan(0);
	expect(srcs.every((s) => s.startsWith("/"))).toBe(true);
	const js = await (await fetch(`${d.url}${srcs[0]}`)).text();
	expect(js).toContain("/api/runs");
});
