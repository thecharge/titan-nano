// Tries to reproduce "serial collapse" and to break the rewards that are said to prevent it.
// A toy: an orchestrator learns how many agents to start in parallel for a goal.
// Usage: bun simulate.ts   (fixed seed, so every run prints the same numbers)
//
// The toy world, stated as assumptions, not facts:
// - A goal has w independent parts (w is 1, 4 or 8). The orchestrator picks k agents (1, 2, 4 or 8).
// - Each agent does ceil(w / k) parts one after another. Agents beyond w get no part (empty agents).
// - Time on the critical path = 1 (the orchestrator) + ceil(w / k).
// - One agent alone does each part with success 0.9, because it has the whole context.
// - Rewards G, H and I also charge for each agent started, because each agent costs tokens.
// - Parallel agents start worse at splitting the work: success per part is 0.9 - 0.4 * exp(-practice / 30),
//   where practice counts earlier episodes that used k > 1. This is the skill that serial collapse never learns.
let seed = 20261105;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const WIDTHS = [1, 4, 8], KS = [1, 2, 4, 8];
const EPISODES = 3000, GROUP = 4, RUNS = 200, LR = 0.5;

type Reward = { name: string; cost?: number; latency: number; parallel: number; finish: number; anneal: "linear" | "abrupt" | "none"; deadline: number };
const rewards: Reward[] = [
  { name: "A. outcome only", latency: 0, parallel: 0, finish: 0, anneal: "none", deadline: Infinity },
  { name: "B. outcome and time on the critical path", latency: 0.05, parallel: 0, finish: 0, anneal: "none", deadline: Infinity },
  { name: "C. B + parallel bonus + finish reward, both lowered step by step to 0", latency: 0.05, parallel: 0.5, finish: 0.5, anneal: "linear", deadline: Infinity },
  { name: "D. B + parallel bonus only (no finish reward), lowered step by step", latency: 0.05, parallel: 0.5, finish: 0, anneal: "linear", deadline: Infinity },
  { name: "E. like C, but both bonuses removed at once after 30 % of training", latency: 0.05, parallel: 0.5, finish: 0.5, anneal: "abrupt", deadline: Infinity },
  { name: "G. like C, plus a small cost for each agent started (0.01)", cost: 0.01, latency: 0.05, parallel: 0.5, finish: 0.5, anneal: "linear", deadline: Infinity },
  { name: "H. like C, plus a large cost for each agent started (0.1)", cost: 0.1, latency: 0.05, parallel: 0.5, finish: 0.5, anneal: "linear", deadline: Infinity },
  { name: "I. outcome, time and a small agent cost (0.01), no bonuses", cost: 0.01, latency: 0.05, parallel: 0, finish: 0, anneal: "none", deadline: Infinity },
  { name: "F. outcome only, with a time limit of 4 (serial work on 8 parts runs out of time)", latency: 0, parallel: 0, finish: 0, anneal: "none", deadline: 4 },
];

function episode(w: number, k: number, practice: number, R: Reward, frac: number) {
  const per = Math.ceil(w / k), time = 1 + per, used = Math.min(k, w);
  const p = k === 1 ? 0.9 : 0.9 - 0.4 * Math.exp(-practice / 30);
  let done = 0; for (let i = 0; i < w; i++) if (rnd() < p) done++;
  const outcome = time > R.deadline ? 0 : done / w;
  const lam = R.anneal === "none" ? 0 : R.anneal === "linear" ? Math.max(0, 1 - frac / 0.6) : frac < 0.3 ? 1 : 0;
  const rParallel = (k - 1) / 7;            // counts every agent started, empty ones too
  const rFinish = (done * used / w) / k;    // parts finished per agent started: empty agents lower it
  return { r: outcome - R.latency * time - (R.cost ?? 0) * k + lam * (R.parallel * rParallel + R.finish * rFinish), time, outcome };
}

console.log(`${RUNS} training runs per reward, ${EPISODES} episodes each, groups of ${GROUP} tries per episode (group-relative advantage, as in GRPO).`);
console.log("After training, the most likely k for each goal width, and the results of that choice:\n");
for (const R of rewards) {
  let collapse = 0, spurious = 0; const pick: Record<number, number[]> = { 1: [], 4: [], 8: [] }; let out = 0, time = 0;
  for (let run = 0; run < RUNS; run++) {
    const logits: Record<number, number[]> = { 1: [0, 0, 0, 0], 4: [0, 0, 0, 0], 8: [0, 0, 0, 0] };
    let practice = 0;
    for (let e = 0; e < EPISODES; e++) {
      const w = WIDTHS[Math.floor(rnd() * 3)], L = logits[w];
      const m = Math.max(...L), ex = L.map((x) => Math.exp(x - m)), Z = ex.reduce((a, b) => a + b), pr = ex.map((x) => x / Z);
      const tries = Array.from({ length: GROUP }, () => { let u = rnd(), j = 0; while (j < 3 && (u -= pr[j]) > 0) j++; const res = episode(w, KS[j], practice, R, e / EPISODES); return { j, r: res.r }; });
      for (const t of tries) if (KS[t.j] > 1) practice++;
      const mean = tries.reduce((a, t) => a + t.r, 0) / GROUP, sd = Math.sqrt(tries.reduce((a, t) => a + (t.r - mean) ** 2, 0) / GROUP) || 1;
      for (const t of tries) { const adv = (t.r - mean) / sd; for (let j = 0; j < 4; j++) L[j] += (LR / GROUP) * adv * ((j === t.j ? 1 : 0) - pr[j]); }
    }
    for (const w of WIDTHS) { const L = logits[w]; pick[w].push(KS[L.indexOf(Math.max(...L))]); }
    const k8 = pick[8].at(-1)!, k4 = pick[4].at(-1)!;
    if (k8 === 1) collapse++;
    if (k4 > 4) spurious++;
    const final = episode(8, k8, practice, { ...R, parallel: 0, finish: 0, latency: 0, cost: 0 }, 1); out += final.outcome; time += final.time;
  }
  const share = (w: number) => KS.map((k) => `k=${k}: ${(100 * pick[w].filter((x) => x === k).length / RUNS).toFixed(0)} %`).join(", ");
  console.log(`- ${R.name}`);
  console.log(`    goals with 8 parts: ${share(8)}`);
  console.log(`    goals with 4 parts: ${share(4)}`);
  console.log(`    serial collapse (k=1 for 8 parts): ${(100 * collapse / RUNS).toFixed(1)} % of runs; empty agents (k>4 for 4 parts): ${(100 * spurious / RUNS).toFixed(1)} % of runs`);
  console.log(`    on goals with 8 parts: share of parts done ${(out / RUNS).toFixed(2)}, time on the critical path ${(time / RUNS).toFixed(2)}`);
}
