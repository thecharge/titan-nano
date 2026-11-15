import { describe, expect, test } from "bun:test";
import type { AgentBackend } from "../src/port";
// One contract, run against every adapter: the fake, the mock-model adapter, and (behind a flag) the live one.
export function backendContract(
	label: string,
	make: () => AgentBackend,
	opts: { skip?: boolean } = {},
) {
	describe.skipIf(!!opts.skip)(`backend contract: ${label}`, () => {
		test("answers a turn with text", async () => {
			const a = await make().run({ persona: "tester", task: "say ok" });
			expect(typeof a.text).toBe("string");
			expect(a.text.length).toBeGreaterThan(0);
		});
		test("reports usage as numbers", async () => {
			const a = await make().run({ persona: "tester", task: "say ok" });
			expect(Number.isFinite(a.usage.input)).toBe(true);
			expect(Number.isFinite(a.usage.output)).toBe(true);
		});
	});
}
