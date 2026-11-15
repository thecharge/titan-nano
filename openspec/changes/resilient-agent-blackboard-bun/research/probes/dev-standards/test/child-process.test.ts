import { expect, test } from "bun:test";
import cp from "node:child_process";
import path from "node:path";

test("curl in a child process is blocked", () => {
	expect(() => Bun.spawnSync(["curl", "https://example.com/"])).toThrow(
		"process blocked in tests: curl",
	);
});
test("the real claude CLI is blocked", () => {
	expect(() => cp.spawnSync("claude", ["-p", "hi"])).toThrow(
		"process blocked in tests: claude",
	);
});
test("sh is blocked, so sh -c curl cannot get around the list", () => {
	expect(() => cp.execSync("curl https://example.com/")).toThrow(
		"process blocked",
	);
});
test("a fake agent under test/fixtures is allowed", async () => {
	const p = Bun.spawn(
		[process.execPath, path.join(import.meta.dir, "fixtures/fake-agent.ts")],
		{ stdin: "pipe", stdout: "pipe" },
	);
	p.stdin.write("find the bug");
	p.stdin.end();
	const out = JSON.parse(await new Response(p.stdout).text());
	expect(out.result).toBe("fake answer to: find the bug");
});
