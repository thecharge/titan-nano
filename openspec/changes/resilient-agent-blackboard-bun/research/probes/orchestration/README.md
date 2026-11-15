# Orchestration probe: serial collapse

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10.

*Serial collapse* is when an orchestrator learns to run everything with one agent, even when it could run several agents at once.

- `simulate.ts`: a toy. An orchestrator learns how many agents to start in parallel for goals with 1, 4 or 8 independent parts. It learns from groups of 4 tries, each compared with the mean of its group, as in GRPO. Parallel agents start worse at splitting the work and get better with practice. The file header lists every assumption of the toy. Run `bun simulate.ts`. Output: `simulate-output.txt`.
- The script compares 9 rewards. Rewards A to F came first. Rewards G, H and I were added after C and D started agents with no work in 100 % of runs.
- The weights (0.05 for time, 0.01 and 0.1 for each agent) are guesses that have not been measured.
- A toy shows a mechanism, not how real agents behave. Real goals have parts that depend on each other, and real agents fail in more ways.
