import { runCandidates } from "@titan/runner";

async function race(count: number, survivors: number[], answer: unknown) {
  const pairs: string[] = [];
  const record = await runCandidates(
    count,
    async (index) => ({
      index,
      survived: survivors.includes(index),
      evidence: survivors.includes(index) ? [] : [`flaw-${index}`],
      result: `result-${index}`,
    }),
    async (first, second) => {
      pairs.push(`${first.index}-${second.index}`);
      return answer;
    },
  );
  return { pairs, record };
}

export async function threeCandidatesTwoSurvive(winner: string) {
  const { pairs, record } = await race(3, [1, 2], {
    winner,
    reason: "same result with half the steps",
  });
  const verdicts = record.candidates.map((item) => (item.survived ? "S" : "F")).join("");
  return `${pairs.join(",")}|${record.kept}|${verdicts}|${record.judgements[0]?.reason}`;
}

export async function oneCandidateSurvives(survivors: number[]) {
  const { pairs, record } = await race(3, survivors, { winner: "A", reason: "first is fine" });
  return `${pairs.length}|${record.kept}`;
}

export async function noCandidateSurvives(count: number, survivors: number[]) {
  const { pairs, record } = await race(count, survivors, { winner: "A", reason: "first is fine" });
  return `${record.state}|${record.kept}|${pairs.length}`;
}

export async function judgePicks(winner: string, reason: string) {
  const { record } = await race(2, [0, 1], { winner, reason });
  return `${record.kept}|${record.judgements[0]?.reason}`;
}
