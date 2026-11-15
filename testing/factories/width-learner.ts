import { WidthFixture, WidthLearner } from "@titan/constants";
import {
  eligibleWidths,
  emptyWidthState,
  learnWidth,
  pickWidth,
  seededRandom,
} from "@titan/knowledge";

function scoreOf(parts: number, width: number): number {
  const minutes = Math.ceil(parts / width) * WidthFixture.PartMinutes;
  return (
    WidthFixture.Survived - WidthFixture.TimeWeight * minutes - WidthFixture.AgentWeight * width
  );
}

export function widthSmallShare(seed: number, parts: number, cap: number): boolean {
  const random = seededRandom(seed);
  const eligible = eligibleWidths(parts, cap);
  let state = emptyWidthState();
  const picks: number[] = [];
  for (let run = 0; run < WidthFixture.Runs; run++) {
    const width = pickWidth(random, state, eligible);
    picks.push(width);
    state = learnWidth(state, width, scoreOf(parts, width));
  }
  const last = picks.slice(-WidthFixture.Last);
  const small = last.filter((width) => width === WidthFixture.OneWidth).length;
  return small / last.length < WidthFixture.Limit;
}

export function widthTrails(
  scores: readonly number[],
  widths: readonly number[],
  digits: number,
): string {
  let state = emptyWidthState();
  scores.forEach((score, index) => {
    state = learnWidth(state, widths[index] ?? WidthLearner.None, score);
  });
  const show = (values: readonly number[]) =>
    values.map((value) => value.toFixed(digits)).join(WidthFixture.List);
  return [show(state.positive), show(state.negative)].join(WidthFixture.Join);
}

export function widthEligible(parts: number, cap: number): string {
  return eligibleWidths(parts, cap).join(WidthFixture.List);
}

export function widthFirst(seed: number, parts: number, cap: number): number {
  return pickWidth(seededRandom(seed), emptyWidthState(), eligibleWidths(parts, cap));
}
