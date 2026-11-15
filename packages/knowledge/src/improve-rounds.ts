import { ImproveOutcome } from "@titan/constants";
import type { ImproveRecord, ImproveRound, ImproveRoundRunner } from "@titan/types";

export async function runImproveRounds(
  rounds: number,
  runRound: ImproveRoundRunner,
): Promise<ImproveRecord> {
  const record: ImproveRound[] = [];
  for (let round = 1; round <= rounds; round++) {
    const kept = await runRound(round);
    const outcome = kept.length > 0 ? ImproveOutcome.Kept : ImproveOutcome.Nothing;
    record.push({ round, kept, outcome });
    if (outcome === ImproveOutcome.Nothing) break;
  }
  return { rounds: record };
}
