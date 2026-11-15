// A fake titan run record: what events.jsonl would hold for one run.
export type Ev = { id: number; t: number; kind: string; step?: string; persona?: string; tool?: string; verdict?: string; proof?: string; tokens_in?: number; tokens_out?: number; cost_usd?: number };
export const RUN_ID = "run-2026-11-06-001";
export const WORKFLOW = "prove-sum-formula";
const t0 = Date.parse("2026-11-06T09:00:00Z");
export const events: Ev[] = [
	{ id: 1, t: t0, kind: "run_started" },
	{ id: 2, t: t0 + 10, kind: "agent_started", step: "prove", persona: "lean-prover" },
	{ id: 3, t: t0 + 400, kind: "tool_called", step: "prove", persona: "lean-prover", tool: "lean_check" },
	{ id: 4, t: t0 + 2400, kind: "agent_answered", step: "prove", persona: "lean-prover", tokens_in: 1200, tokens_out: 800, cost_usd: 0.02 },
	{ id: 5, t: t0 + 2500, kind: "check_done", step: "prove", proof: "proven" },
	{ id: 6, t: t0 + 2600, kind: "agent_started", step: "review", persona: "skeptic" },
	{ id: 7, t: t0 + 4000, kind: "agent_answered", step: "review", persona: "skeptic", verdict: "survived", tokens_in: 900, tokens_out: 200, cost_usd: 0.01 },
	{ id: 8, t: t0 + 4100, kind: "run_ended", verdict: "passed" },
];
