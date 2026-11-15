import { PolicyAlarmFixture } from "@titan/constants";
import { policyAlarms } from "@titan/knowledge";
import { type BoardPost, type PolicyAlarmRun, PolicyAlarmRunSchema } from "@titan/types";

function alarmLines(posts: readonly BoardPost[], needle: string): number {
  return posts
    .map((post) => JSON.stringify(post))
    .filter((line) => line.includes(PolicyAlarmFixture.KindJson) && line.includes(needle)).length;
}

function splitRun(width: number, allowed: number): PolicyAlarmRun {
  return PolicyAlarmRunSchema.parse({
    splits: [{ parts: PolicyAlarmFixture.Parts, width, allowed }],
    agents: 0,
    empty: 0,
  });
}

export function serialAlarm(
  kind: string,
  collapsed: number,
  total: number,
  allowed: number,
  run: number,
  since: number | undefined,
): string {
  const window = Array.from({ length: total }, (_, index) =>
    splitRun(index < collapsed ? 1 : PolicyAlarmFixture.Wide, allowed),
  );
  const result = policyAlarms({ kind, run, window, w_agent: 0, since });
  const lines = alarmLines(result.posts, PolicyAlarmFixture.SerialText);
  const bonus = result.serial?.bonus.toFixed(PolicyAlarmFixture.Digits) ?? PolicyAlarmFixture.None;
  return `${lines} ${bonus} ${result.serial?.zero_at ?? PolicyAlarmFixture.None}`;
}

export function emptyAlarm(
  kind: string,
  runs: number,
  agents: number,
  empty: number,
  wAgent: number,
): string {
  const window = Array.from({ length: runs }, (_, index) =>
    PolicyAlarmRunSchema.parse({ splits: [], agents, empty: index < empty ? 1 : 0 }),
  );
  const result = policyAlarms({ kind, run: runs, window, w_agent: wAgent });
  const lines = alarmLines(result.posts, PolicyAlarmFixture.EmptyText);
  const share = result.empty.share.toFixed(PolicyAlarmFixture.ShareDigits);
  return `${lines} ${result.empty.multiplier} ${result.empty.w_agent} ${share}`;
}
