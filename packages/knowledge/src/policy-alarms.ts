import { BoardParty, PolicyAlarm } from "@titan/constants";
import { emptyAgentsText, serialCollapseText } from "@titan/messages";
import {
  type BoardPost,
  type PolicyAlarmInput,
  PolicyAlarmInputSchema,
  type PolicyAlarms,
  PolicyAlarmsSchema,
  type PolicySerial,
} from "@titan/types";

function alarmPost(text: string): BoardPost {
  return {
    from: BoardParty.Titan,
    to: PolicyAlarm.PostTo,
    kind: PolicyAlarm.PostKind,
    text,
  };
}

export function policyAlarms(raw: PolicyAlarmInput): PolicyAlarms {
  const input = PolicyAlarmInputSchema.parse(raw);
  const window = input.window.slice(-PolicyAlarm.Window);
  const splits = window
    .flatMap((run) => run.splits)
    .filter((split) => split.parts >= PolicyAlarm.MinParts && split.allowed > 1);
  const narrow = splits.filter((split) => split.width === PolicyAlarm.SingleWidth).length;
  const started = window.reduce((sum, run) => sum + run.agents, 0);
  const none = window.reduce((sum, run) => sum + run.empty, 0);
  const share = started > 0 ? none / started : 0;
  const emptyOn = share > PolicyAlarm.EmptyShare;
  const posts: BoardPost[] = [];
  const since = input.since;
  let serial: PolicySerial | undefined;
  if (since !== undefined && input.run - since < PolicyAlarm.Window)
    serial = {
      bonus: PolicyAlarm.Bonus * (1 - (input.run - since) / PolicyAlarm.Window),
      since,
      zero_at: since + PolicyAlarm.Window,
    };
  else if (narrow > splits.length * PolicyAlarm.CollapseShare) {
    serial = {
      bonus: PolicyAlarm.Bonus,
      since: input.run,
      zero_at: input.run + PolicyAlarm.Window,
    };
    posts.push(alarmPost(serialCollapseText(input.kind, narrow, splits.length)));
  }
  if (emptyOn) posts.push(alarmPost(emptyAgentsText(input.kind, none, started)));
  return PolicyAlarmsSchema.parse({
    serial,
    empty: {
      w_agent: input.w_agent,
      multiplier: emptyOn ? PolicyAlarm.EmptyMultiplier : PolicyAlarm.BaseMultiplier,
      share,
    },
    posts,
  });
}
