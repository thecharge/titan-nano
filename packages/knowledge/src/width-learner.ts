import { WidthLearner } from "@titan/constants";
import type { Random, WidthState } from "@titan/types";
import { betaDraw } from "./persona-pick.ts";

const widthList: readonly number[] = WidthLearner.Widths;

function settle(value: number): number {
  return Math.round(value * WidthLearner.Precision);
}

function zeros(): number[] {
  return widthList.map(() => WidthLearner.None);
}

export function emptyWidthState(): WidthState {
  return { positive: zeros(), negative: zeros(), scores: [] };
}

export function eligibleWidths(parts: number, cap: number): number[] {
  return widthList.filter((width) => width <= Math.min(parts, cap));
}

export function pickWidth(random: Random, state: WidthState, eligible: readonly number[]): number {
  let best: number = WidthLearner.None;
  let highest: number = WidthLearner.Floor;
  for (const width of eligible) {
    const index = widthList.indexOf(width);
    const draw = betaDraw(
      random,
      state.positive[index] ?? WidthLearner.None,
      state.negative[index] ?? WidthLearner.None,
    );
    if (draw > highest) {
      highest = draw;
      best = width;
    }
  }
  return best;
}

export function learnWidth(state: WidthState, width: number, score: number): WidthState {
  const index = widthList.indexOf(width);
  const positive = state.positive.map((value) => value * WidthLearner.Fade);
  const negative = state.negative.map((value) => value * WidthLearner.Fade);
  const recent = state.scores.slice(-WidthLearner.Group);
  if (recent.length > WidthLearner.None) {
    const mean = recent.reduce((sum, value) => sum + value, WidthLearner.None) / recent.length;
    const gap = settle(score) - settle(mean);
    if (gap > WidthLearner.None)
      positive[index] = (positive[index] ?? WidthLearner.None) + WidthLearner.Step;
    if (gap < WidthLearner.None)
      negative[index] = (negative[index] ?? WidthLearner.None) + WidthLearner.Step;
  }
  return { positive, negative, scores: [...recent, score] };
}
