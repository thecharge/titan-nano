import { PersonaBound, WilsonCheck, WilsonRun } from "@titan/constants";
import { seededRandom, wilson } from "@titan/knowledge";

export function wilsonExample(survived: number, total: number, bound: PersonaBound): string {
  const bounds = wilson(survived, total);
  const shown = bound === PersonaBound.Lower ? bounds.lower : bounds.upper;
  return shown.toFixed(WilsonRun.Digits);
}

export function wilsonPair(survived: number, total: number): string {
  const bounds = wilson(survived, total);
  return [bounds.lower, bounds.upper]
    .map((value) => value.toFixed(WilsonRun.Digits))
    .join(WilsonRun.Pair);
}

export function wilsonProperty(seed: number, runs: number, check: WilsonCheck): string {
  let state = seed;
  const next = (): number => {
    state = (state * WilsonRun.Multiplier) % WilsonRun.Modulus;
    return state / WilsonRun.Modulus;
  };
  let broken = 0;
  for (let index = 0; index < runs; index += 1) {
    const total = index === 0 ? 0 : Math.floor(next() * (WilsonRun.MaxTotal + 1));
    const survived = Math.floor(next() * (total + 1));
    const bounds = wilson(survived, total);
    const rate = total === 0 ? 0 : survived / total;
    const holds =
      bounds.lower >= 0 &&
      bounds.lower <= bounds.upper &&
      bounds.upper <= 1 &&
      (total === 0
        ? bounds.lower === 0 && bounds.upper === 1
        : bounds.lower <= rate + WilsonRun.Tolerance && bounds.upper >= rate - WilsonRun.Tolerance);
    if (holds !== (check === WilsonCheck.Holds)) broken += 1;
  }
  return `${runs} ${broken}`;
}

export function wilsonWidthProperty(seed: number, runs: number, check: WilsonCheck): string {
  const random = seededRandom(seed);
  let broken = 0;
  for (let index = 0; index < runs; index++) {
    const total = 1 + Math.floor(random() * WilsonRun.MaxTotal);
    const survived = Math.floor(random() * (total + 1));
    const original = wilson(survived, total);
    const larger = wilson(survived * WilsonRun.SampleScale, total * WilsonRun.SampleScale);
    const holds = larger.upper - larger.lower < original.upper - original.lower;
    if (holds !== (check === WilsonCheck.Holds)) broken++;
  }
  return `${runs} ${broken}`;
}
