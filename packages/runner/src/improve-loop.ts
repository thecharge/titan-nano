import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FileEncoding, ImproveLoop, Improvement } from "@titan/constants";
import { errorMessage } from "@titan/errors";
import type {
  ImproveLoopRequest,
  ImproveLoopRound,
  ImprovementOutcome,
  ImproveReport,
  ImproveRoundResult,
  ImproverAnswer,
  Plan,
} from "@titan/types";
import { evaluateImprovement } from "./improvement.ts";

async function decide(
  request: ImproveLoopRequest,
  best: Plan,
  previous: ImprovementOutcome,
  answer: ImproverAnswer,
): Promise<ImproveRoundResult> {
  let next: Plan;
  try {
    next = request.validate(answer.workflow);
  } catch (error) {
    return {
      decision: { file: null, reason: errorMessage(error), report: Improvement.NoReport },
      next: best,
      outcome: previous,
    };
  }
  let outcome = previous;
  const decision = await evaluateImprovement({
    directory: request.directory,
    name: request.name,
    old: best,
    next,
    answer,
    ...(request.lessons === undefined ? {} : { lessons: request.lessons }),
    previous,
    rerun: async (plan) => {
      outcome = await request.rerun(plan);
      return outcome;
    },
  });
  return { decision, next, outcome };
}

export async function improveLoop(request: ImproveLoopRequest): Promise<ImproveReport> {
  const rounds: ImproveLoopRound[] = [];
  let best = request.start;
  let text = request.workflow;
  let previous = request.previous;
  for (let round = ImproveLoop.FirstRound; round <= request.rounds; round++) {
    const answer = await request.propose(text);
    const result = await decide(request, best, previous, answer);
    rounds.push({ round, ...result.decision });
    if (result.decision.file === null) break;
    best = result.next;
    previous = result.outcome;
    text = await readFile(resolve(request.directory, result.decision.file), FileEncoding.Utf8);
  }
  return {
    run_id: request.run_id,
    rounds,
    kept: rounds.some((entry) => entry.file !== null),
  };
}
