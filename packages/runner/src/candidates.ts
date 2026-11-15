import { ErrorCode, JudgeWinner, StepStatus } from "@titan/constants";
import { all } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import {
  type CandidateAttempt,
  type CandidateJudge,
  type CandidateOutcome,
  type CandidateRecord,
  JudgeAnswerSchema,
  type Judgement,
} from "@titan/types";

export async function runCandidates(
  count: number,
  attempt: CandidateAttempt,
  judge: CandidateJudge,
): Promise<CandidateRecord> {
  const candidates = await all(
    Array.from({ length: count }, (_, index) => () => attempt(index)),
    count,
  );
  const survivors = candidates.filter((candidate) => candidate.survived);
  const judgements: Judgement[] = [];
  let winner: CandidateOutcome | undefined = survivors[0];
  for (const next of survivors.slice(1)) {
    if (!winner) break;
    const parsed = JudgeAnswerSchema.safeParse(await judge(winner, next));
    if (!parsed.success)
      throw new OperationalError(ErrorCode.CheckerProtocol, RunnerMessage.InvalidJudgement);
    const kept = parsed.data.winner === JudgeWinner.First ? winner : next;
    judgements.push({
      first: winner.index,
      second: next.index,
      kept: kept.index,
      reason: parsed.data.reason,
    });
    winner = kept;
  }
  return {
    state: winner ? StepStatus.Passed : StepStatus.Failed,
    candidates,
    judgements,
    kept: winner ? winner.index : null,
  };
}
