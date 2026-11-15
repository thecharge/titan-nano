import { generateText, type LanguageModel } from "ai";
import type { AgentBackend, Answer, Turn } from "./port";
// The model-API adapter. The model is passed in, so a test can pass a mock model.
export function apiBackend(model: LanguageModel): AgentBackend {
	return {
		name: "api",
		async run(turn: Turn): Promise<Answer> {
			const r = await generateText({
				model,
				system: `You are ${turn.persona}.`,
				prompt: turn.task,
			});
			return {
				text: r.text,
				usage: {
					input: r.usage.inputTokens ?? 0,
					output: r.usage.outputTokens ?? 0,
				},
			};
		},
	};
}
