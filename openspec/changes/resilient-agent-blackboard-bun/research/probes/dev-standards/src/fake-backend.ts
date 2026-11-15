import type { AgentBackend, Answer, Turn } from "./port";
// Scripted answers by task text. Fails fast on a task it has no script for.
export function fakeBackend(
	script: Record<string, string>,
): AgentBackend & { calls: Turn[] } {
	const calls: Turn[] = [];
	return {
		name: "fake",
		calls,
		async run(turn: Turn): Promise<Answer> {
			calls.push(turn);
			const text = script[turn.task];
			if (text === undefined)
				throw new Error(`fake backend has no script for task: ${turn.task}`);
			return { text, usage: { input: 0, output: 0 } };
		},
	};
}
