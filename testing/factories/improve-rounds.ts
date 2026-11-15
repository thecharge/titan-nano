import { runImproveRounds } from "@titan/knowledge";
import { ImproveRoundSchema } from "@titan/types";

export async function improveRounds(rounds: number, plan: readonly unknown[]): Promise<string> {
  const kept = ImproveRoundSchema.shape.kept.array().parse(plan);
  const called: number[] = [];
  const record = await runImproveRounds(rounds, async (round) => {
    called.push(round);
    return kept[round - 1] ?? [];
  });
  const outcomes = record.rounds.map((entry) => entry.outcome).join(",");
  return `${called.length} ${outcomes}`;
}
