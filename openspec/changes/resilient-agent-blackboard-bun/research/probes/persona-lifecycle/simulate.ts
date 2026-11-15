// Tries to break rules for "this persona needs an update" and for "which persona to pick".
// A persona's true survival rate is the share of its results that survive falsification.
// The simulation draws outcomes from known rates and checks how often each rule is wrong.
// Usage: bun simulate.ts   (fixed seed, so the output is the same on every run)
let seed = 20261105;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const BAR = 0.6;      // the survival rate a persona must reach: a guess, not measured
const USES = 30;      // uses watched per persona
const TRIALS = 20000; // simulated personas per case

// Wilson score interval, 95 % (z = 1.96).
function wilson(s: number, n: number) {
  const z = 1.96, p = s / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [c - h, c + h];
}
const rules: Record<string, (s: number, n: number) => boolean> = {
  "raw rate below the bar after 3 uses": (s, n) => n >= 3 && s / n < BAR,
  "raw rate below the bar after 10 uses": (s, n) => n >= 10 && s / n < BAR,
  "Wilson upper bound below the bar": (s, n) => n >= 1 && wilson(s, n)[1] < BAR,
};

console.log(`bar ${BAR}, ${USES} uses per persona, ${TRIALS} personas per case\n`);
console.log("Share of personas flagged as 'needs update' at some point within the uses, and the median use at which the flag came:");
for (const [name, rule] of Object.entries(rules)) {
  const row: string[] = [];
  for (const p of [0.75, 0.6, 0.35]) {
    let flagged = 0; const when: number[] = [];
    for (let t = 0; t < TRIALS; t++) {
      let s = 0;
      for (let n = 1; n <= USES; n++) { if (rnd() < p) s++; if (rule(s, n)) { flagged++; when.push(n); break; } }
    }
    when.sort((a, b) => a - b);
    row.push(`true rate ${p}: ${(100 * flagged / TRIALS).toFixed(1)} % flagged${when.length ? `, median use ${when[when.length >> 1]}` : ""}`);
  }
  console.log(`- ${name}:\n    ${row.join("\n    ")}`);
}

// Picking between two personas for the same kind of work.
// Greedy: always pick the one with the best observed rate. Thompson: draw from each Beta(1+s, 1+f) and pick the higher draw.
function beta(a: number, b: number) { // Beta draw from two Gamma draws (Marsaglia and Tsang), a, b >= 1
  const g = (k: number) => { const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;) { let x, v; do { const u1 = rnd(), u2 = rnd(); x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rnd(); if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v; } };
  const x = g(a), y = g(b); return x / (x + y);
}
const PICKS = 200, RUNS = 2000, rates = [0.75, 0.55];
console.log(`\nPicking between two personas with true rates ${rates.join(" and ")}, ${PICKS} picks, ${RUNS} runs:`);
for (const how of ["greedy", "thompson"]) {
  let stuck = 0, worse = 0;
  for (let r = 0; r < RUNS; r++) {
    const s = [0, 0], f = [0, 0];
    for (let i = 0; i < PICKS; i++) {
      let k: number;
      if (how === "greedy") { const m = [0, 1].map((j) => (s[j] + 1) / (s[j] + f[j] + 2)); k = m[0] === m[1] ? (rnd() < 0.5 ? 0 : 1) : m[0] > m[1] ? 0 : 1; }
      else k = beta(1 + s[0], 1 + f[0]) > beta(1 + s[1], 1 + f[1]) ? 0 : 1;
      if (rnd() < rates[k]) s[k]++; else f[k]++;
      if (k === 1) worse++;
    }
    if (s[1] + f[1] > s[0] + f[0]) stuck++;
  }
  console.log(`- ${how}: the worse persona got most picks in ${(100 * stuck / RUNS).toFixed(1)} % of runs; ${(100 * worse / (RUNS * PICKS)).toFixed(1)} % of all picks went to it`);
}
