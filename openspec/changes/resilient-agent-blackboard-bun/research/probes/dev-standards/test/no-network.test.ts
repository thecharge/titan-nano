import { expect, test } from "bun:test";
import https from "node:https";
import net from "node:net";

test("fetch to a vendor API is blocked", async () => {
	await expect(fetch("https://api.anthropic.com/v1/messages")).rejects.toThrow(
		"network blocked in tests: api.anthropic.com",
	);
});
test("fetch to RunPod is blocked", async () => {
	await expect(
		fetch("https://api.runpod.ai/v2/x/run", { method: "POST" }),
	).rejects.toThrow("network blocked");
});
test("node:https request is blocked", async () => {
	const err = await new Promise<Error | null>((res) => {
		try {
			const r = https.get("https://example.com/", () => res(null));
			r.on("error", (e) => res(e));
		} catch (e) {
			res(e as Error);
		}
	});
	expect(String(err)).toContain("network blocked");
});
test("node:net socket is blocked", () => {
	expect(() => net.connect({ host: "example.com", port: 80 })).toThrow(
		"network blocked",
	);
});
test("Bun.connect is blocked", () => {
	expect(() =>
		Bun.connect({ hostname: "example.com", port: 80, socket: { data() {} } }),
	).toThrow("network blocked");
});
test("keys are gone", () => {
	expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
	expect(process.env.RUNPOD_API_KEY).toBeUndefined();
});
test("a local server is still allowed", async () => {
	const s = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: () => new Response("ok"),
	});
	const r = await fetch(`http://127.0.0.1:${s.port}/`);
	expect(await r.text()).toBe("ok");
	s.stop(true);
});
