// Small models of two ideas from the papers, written for titan. No package, no model.
import { expect, test } from "bun:test";

// ---- 1. Stall counter and replan (Magentic-One, S19) ----------------------
// Each inner turn reports progress or not. After more than `limit` turns with
// no progress, the outer loop writes a new plan. A worker that repeats the same
// output counts as no progress.
type Turn = { output: string; progress: boolean };
function runWithStallCounter(turns: Turn[], limit: number) {
  let stall = 0;
  let replans = 0;
  let last = "";
  const events: string[] = [];
  for (const t of turns) {
    const loop = t.output === last;
    last = t.output;
    if (t.progress && !loop) stall = Math.max(0, stall - 1);
    else stall++;
    if (stall > limit) {
      replans++;
      events.push(`replan after "${t.output}"`);
      stall = 0;
      last = "";
    }
  }
  return { replans, events };
}

test("stall counter: a loop of the same output starts a new plan", () => {
  const turns: Turn[] = [
    { output: "read file", progress: true },
    { output: "run test", progress: true },
    { output: "run test", progress: true }, // same output: loop
    { output: "run test", progress: true },
    { output: "run test", progress: true },
    { output: "fix import", progress: true },
  ];
  const r = runWithStallCounter(turns, 2);
  console.log("stall counter, limit 2:", r);
  expect(r.replans).toBe(1);
});

test("stall counter: steady progress never starts a new plan", () => {
  const turns = Array.from({ length: 10 }, (_, i) => ({ output: `step ${i}`, progress: true }));
  expect(runWithStallCounter(turns, 2).replans).toBe(0);
});

// ---- 2. Majority vote with shared errors (S25 against S28) ----------------
// Each of n samples is wrong with chance p. With chance rho, all samples share
// one draw (the same mistake). Otherwise each sample draws on its own.
// A seeded random generator keeps the result the same on every run.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function voteError(n: number, p: number, rho: number, trials: number, seed: number) {
  const rnd = mulberry32(seed);
  let wrong = 0;
  for (let i = 0; i < trials; i++) {
    let bad = 0;
    if (rnd() < rho) bad = rnd() < p ? n : 0;
    else for (let k = 0; k < n; k++) if (rnd() < p) bad++;
    if (bad > n / 2) wrong++;
  }
  return wrong / trials;
}
function binomialTail(n: number, p: number) {
  // chance that more than half of n independent samples are wrong
  let s = 0;
  const choose = (a: number, b: number) => {
    let r = 1;
    for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i;
    return r;
  };
  for (let k = Math.floor(n / 2) + 1; k <= n; k++) s += choose(n, k) * p ** k * (1 - p) ** (n - k);
  return s;
}

test("vote: independent errors fall as in the Six Sigma example; shared errors do not", () => {
  const n = 5;
  const p = 0.05;
  const exact = binomialTail(n, p);
  const rows = [0, 0.1, 0.3, 0.5, 1].map((rho) => ({ rho, voteError: voteError(n, p, rho, 200_000, 42) }));
  console.log(`5 votes, 5 % error each. Exact independent error: ${(exact * 100).toFixed(3)} %`);
  for (const r of rows) console.log(`  shared share ${r.rho}: vote error ${(r.voteError * 100).toFixed(3)} %`);
  expect(exact).toBeCloseTo(0.00116, 4); // S28 rounds this to 0.11 %
  expect(rows[0]!.voteError).toBeLessThan(0.002);
  expect(rows[4]!.voteError).toBeGreaterThan(0.045); // fully shared: no gain over one sample
  expect(rows[2]!.voteError).toBeGreaterThan(10 * exact);
});
