import { expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { apiBackend } from "../src/api-backend";
import { fakeBackend } from "../src/fake-backend";
import { backendContract } from "./backend-contract";

const mockModel = () =>
	new MockLanguageModelV4({
		doGenerate: async () => ({
			content: [{ type: "text", text: "ok" }],
			finishReason: { unified: "stop", raw: undefined },
			usage: {
				inputTokens: {
					total: 10,
					noCache: 10,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: { total: 2, text: 2, reasoning: undefined },
			},
			warnings: [],
		}),
	});

backendContract("fake", () => fakeBackend({ "say ok": "ok" }));
backendContract("api adapter with mock model", () => apiBackend(mockModel()));
// Live: runs only with TITAN_LIVE_API=1. The preload then lets the network and keys through.
backendContract(
	"api adapter, live Anthropic",
	() => {
		const { anthropic } = require("@ai-sdk/anthropic");
		return apiBackend(anthropic("claude-haiku-5-5"));
	},
	{ skip: process.env.TITAN_LIVE_API !== "1" },
);

test("the fake fails fast on an unscripted task", async () => {
	await expect(
		fakeBackend({}).run({ persona: "p", task: "other" }),
	).rejects.toThrow("no script for task: other");
});
test("the adapter sends the persona as the system text", async () => {
	const m = mockModel();
	await apiBackend(m).run({ persona: "skeptic", task: "say ok" });
	expect(JSON.stringify(m.doGenerateCalls[0]!.prompt)).toContain(
		"You are skeptic.",
	);
});
