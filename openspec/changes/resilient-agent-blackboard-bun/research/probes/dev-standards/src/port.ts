// A tiny copy of the backend port from the design: one agent turn in, one answer out.
export type Turn = { persona: string; task: string };
export type Answer = { text: string; usage: { input: number; output: number } };
export interface AgentBackend {
	name: string;
	run(turn: Turn): Promise<Answer>;
}
