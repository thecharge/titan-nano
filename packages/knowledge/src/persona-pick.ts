import { PersonaPickRun, PersonaRule } from "@titan/constants";
import type {
  PersonaCount,
  PersonaSimulation,
  PersonaSimulationResult,
  Random,
} from "@titan/types";

export function seededRandom(seed: number): Random {
  let state = seed;
  return () => {
    state = (state + PersonaPickRun.Step) | 0;
    let mixed = Math.imul(state ^ (state >>> PersonaPickRun.ShiftFirst), 1 | state);
    mixed =
      (mixed +
        Math.imul(mixed ^ (mixed >>> PersonaPickRun.ShiftSecond), PersonaPickRun.OrMask | mixed)) ^
      mixed;
    return ((mixed ^ (mixed >>> PersonaPickRun.ShiftThird)) >>> 0) / PersonaPickRun.Range;
  };
}

function normal(random: Random): number {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(PersonaPickRun.TwoPi * random());
}

function gamma(random: Random, shape: number): number {
  const offset = shape - PersonaPickRun.GammaShift;
  const curve = 1 / Math.sqrt(PersonaPickRun.GammaScale * offset);
  let accepted = 0;
  while (accepted === 0) {
    const x = normal(random);
    const base = 1 + curve * x;
    if (base > 0) {
      const cube = base ** PersonaPickRun.Cube;
      const bound =
        PersonaPickRun.HalfCurve * x * x + offset - offset * cube + offset * Math.log(cube);
      if (Math.log(random()) < bound) accepted = offset * cube;
    }
  }
  return accepted;
}

export function betaDraw(random: Random, survived: number, refuted: number): number {
  const left = gamma(random, 1 + survived);
  const right = gamma(random, 1 + refuted);
  return left / (left + right);
}

export function floorShare(eligible: number): number {
  return Math.min(PersonaRule.FloorShare, 1 / eligible);
}

export function pickPersona(random: Random, counts: readonly PersonaCount[]): number {
  if (random() < counts.length * floorShare(counts.length))
    return Math.floor(random() * counts.length);
  let best = 0;
  let highest = -1;
  counts.forEach((count, index) => {
    const draw = betaDraw(random, count.survived, count.refuted);
    if (draw > highest) {
      highest = draw;
      best = index;
    }
  });
  return best;
}

function fadeCounts(counts: PersonaCount[]): void {
  for (const count of counts) {
    count.survived *= PersonaRule.Fade;
    count.refuted *= PersonaRule.Fade;
  }
}

function phaseShares(
  random: Random,
  counts: PersonaCount[],
  rates: readonly number[],
  picks: number,
): number[] {
  const taken = rates.map(() => 0);
  for (let pick = 0; pick < picks; pick++) {
    const chosen = pickPersona(random, counts);
    fadeCounts(counts);
    taken[chosen] = (taken[chosen] ?? 0) + 1;
    const rate = rates[chosen] ?? 0;
    const count = counts[chosen];
    if (count) {
      if (random() < rate) count.survived += 1;
      else count.refuted += 1;
    }
  }
  return taken.map((value) => value / picks);
}

export function simulatePicks(spec: PersonaSimulation): PersonaSimulationResult {
  const random = seededRandom(spec.seed);
  const phases = spec.swap ? [spec.rates, [...spec.rates].reverse()] : [spec.rates];
  let lastTotal = 0;
  let breaches = 0;
  for (let repeat = 0; repeat < spec.repeats; repeat++) {
    const counts: PersonaCount[] = spec.rates.map(() => ({ survived: 0, refuted: 0 }));
    let shares: number[] = [];
    for (const rates of phases) shares = phaseShares(random, counts, rates, spec.picks);
    lastTotal += shares[1] ?? 0;
    if (shares.some((share) => share < PersonaPickRun.ShareLimit)) breaches += 1;
  }
  return { lastShare: lastTotal / spec.repeats, breachRate: breaches / spec.repeats };
}
