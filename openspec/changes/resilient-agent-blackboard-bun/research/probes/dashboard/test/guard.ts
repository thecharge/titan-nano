// Loaded before every test file by bunfig.toml [test] preload.
// Unit and integration tests may only talk to 127.0.0.1 / localhost / ::1.
// Live tests (TITAN_LIVE_*=1) are the only exception.

import cp from "node:child_process";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";

const live = Object.keys(process.env).some(
	(k) => k.startsWith("TITAN_LIVE_") && process.env[k] === "1",
);
const LOCAL = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const blocked = (host: string) =>
	new Error(`network blocked in tests: ${host}`);

if (!live) {
	// 1. Remove every real key, so no code can use one by accident.
	for (const k of Object.keys(process.env)) {
		if (
			/_API_KEY$|_TOKEN$|^ANTHROPIC_|^OPENAI_|^GEMINI_|^GOOGLE_API|^RUNPOD_/.test(
				k,
			)
		)
			delete process.env[k];
	}
	// 2. fetch
	const realFetch = globalThis.fetch;
	globalThis.fetch = Object.assign(
		async (input: string | URL | Request, init?: RequestInit) => {
			const url = new URL(
				typeof input === "string" || input instanceof URL ? input : input.url,
			);
			if (!LOCAL.has(url.hostname)) throw blocked(url.hostname);
			return realFetch(input, init);
		},
		{ preconnect: () => {} },
	) as typeof fetch;
	// 3. raw sockets: node:net, node:tls and Bun.connect
	const guard = (orig: (...a: any[]) => any) =>
		function (this: unknown, ...a: any[]) {
			const o = a[0];
			const host =
				typeof o === "object" && o
					? (o.host ?? o.hostname ?? "localhost")
					: typeof a[1] === "string"
						? a[1]
						: "localhost";
			if (!LOCAL.has(host)) throw blocked(host);
			return orig.apply(this, a);
		};
	(net as any).connect = guard(net.connect);
	(net as any).createConnection = guard(net.createConnection);
	(tls as any).connect = guard(tls.connect);
	(net.Socket.prototype as any).connect = guard(net.Socket.prototype.connect);
	(Bun as any).connect = guard(Bun.connect);
	// 4. node:http and node:https do not go through the patched node:net in Bun
	//    (falsified by out/no-network-v1-output.txt), so guard them too.
	const guardHttp = (orig: (...a: any[]) => any) =>
		function (this: unknown, ...a: any[]) {
			const o = a[0];
			const host =
				typeof o === "string" || o instanceof URL
					? new URL(o).hostname
					: (o?.hostname ?? o?.host ?? "localhost");
			if (!LOCAL.has(host)) throw blocked(host);
			return orig.apply(this, a);
		};
	for (const m of [http, https] as any[]) {
		m.request = guardHttp(m.request);
		m.get = guardHttp(m.get);
	}
	// 5. Child processes do not load this file (falsified by out/child-process-output.txt).
	//    Tests may start only bun itself, git, and scripts under test/fixtures.
	const FIXTURES = path.resolve(import.meta.dir, "fixtures");
	const allowed = (cmd: string) =>
		cmd === process.execPath ||
		cmd === "bun" ||
		cmd === "git" ||
		path.resolve(cmd).startsWith(FIXTURES + path.sep);
	const cmdOf = (a: any[]) =>
		Array.isArray(a[0])
			? a[0][0]
			: typeof a[0] === "object" && a[0]?.cmd
				? a[0].cmd[0]
				: a[0];
	const guardSpawn = (orig: (...a: any[]) => any) =>
		function (this: unknown, ...a: any[]) {
			const cmd = String(cmdOf(a));
			if (!allowed(cmd)) throw new Error(`process blocked in tests: ${cmd}`);
			return orig.apply(this, a);
		};
	(Bun as any).spawn = guardSpawn(Bun.spawn);
	(Bun as any).spawnSync = guardSpawn(Bun.spawnSync);
	for (const k of [
		"spawn",
		"spawnSync",
		"exec",
		"execSync",
		"execFile",
		"execFileSync",
	] as const)
		(cp as any)[k] = guardSpawn((cp as any)[k]);
}
