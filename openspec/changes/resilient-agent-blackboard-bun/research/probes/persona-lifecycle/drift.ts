// Tries to break Thompson sampling for picking personas in two ways that simulate.ts did not test:
// 1. Drift: a persona's true rate changes after a while (a model update, new kinds of problems).
// 2. One-dominant-agent collapse: two personas are almost equally good, and one gets nearly all the work.
// Usage: bun drift.ts   (fixed seed)
let seed = 20261105;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function gamma(k: number): number { if (k < 1) return gamma(k + 1) * Math.pow(rnd(), 1 / k); const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;) { let x, v; do { const u1 = rnd() || 1e-12, u2 = rnd(); x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rnd() || 1e-12; if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v; } }
const beta = (a: number, b: number) => { const x = gamma(a), y = gamma(b); return x / (x + y); };

// Pick with Thompson sampling. "gamma" < 1 makes old results fade: each pick multiplies all counts by it
// (like a pheromone trail that evaporates). "floor" gives each persona at least that share of picks.
function run(rates: (i: number) => number[], picks: number, g: number, floor: number) {
  const s = [0, 0], f = [0, 0], got = [0, 0]; let good = 0;
  for (let i = 0; i < picks; i++) {
    let k = beta(1 + s[0], 1 + f[0]) > beta(1 + s[1], 1 + f[1]) ? 0 : 1;
    if (floor > 0 && rnd() < 2 * floor) k = rnd() < 0.5 ? 0 : 1;
    const r = rates(i); if (r[k] >= Math.max(...r)) good++;
    for (let j = 0; j < 2; j++) { s[j] *= g; f[j] *= g; }
    if (rnd() < r[k]) s[k]++; else f[k]++; got[k]++;
  }
  return { good: good / picks, got };
}
const RUNS = 2000;
console.log(`Drift: persona 0 has rate 0.75 and persona 1 has 0.55 for 200 picks; then they swap (0.55 and 0.75) for 200 more picks. ${RUNS} runs.`);
for (const [name, g] of [["plain Thompson (no fading)", 1], ["Thompson, counts fade by 0.98 per pick", 0.98], ["Thompson, counts fade by 0.95 per pick", 0.95]] as const) {
  // count only the 200 picks after the swap
  let goodAfter = 0;
  for (let r = 0; r < RUNS; r++) {
    const s = [0, 0], f = [0, 0];
    for (let i = 0; i < 400; i++) {
      const k = beta(1 + s[0], 1 + f[0]) > beta(1 + s[1], 1 + f[1]) ? 0 : 1;
      const rt = i < 200 ? [0.75, 0.55] : [0.55, 0.75];
      if (i >= 200 && k === 1) goodAfter++;
      for (let j = 0; j < 2; j++) { s[j] *= g; f[j] *= g; }
      if (rnd() < rt[k]) s[k]++; else f[k]++;
    }
  }
  console.log(`- ${name}: after the swap, ${(100 * goodAfter / (RUNS * 200)).toFixed(1)} % of picks went to the persona that is now better`);
}

console.log(`\nNear-equal personas: true rates 0.62 and 0.60, 400 picks, ${RUNS} runs.`);
for (const [name, floor] of [["plain Thompson", 0], ["Thompson with a floor of 10 % of picks for each persona", 0.1]] as const) {
  let low = 0, share = 0;
  for (let r = 0; r < RUNS; r++) { const res = run(() => [0.62, 0.6], 400, 1, floor); const m = Math.min(...res.got) / 400; share += m; if (m < 0.1) low++; }
  console.log(`- ${name}: the less-used persona got ${(100 * share / RUNS).toFixed(1)} % of picks on average; it got under 10 % in ${(100 * low / RUNS).toFixed(1)} % of runs`);
}
