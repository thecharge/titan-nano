import { LimitNodesSchema } from "@titan/types";

export function limitUntil(nodes: unknown, now: number): number | null {
  const parsed = LimitNodesSchema.safeParse(nodes);
  if (!parsed.success) return null;
  let until: number | null = null;
  for (const node of Object.values(parsed.data))
    for (const phase of Object.values(node.phases))
      if (!phase.completed && phase.next_retry !== null && phase.next_retry > now)
        until = Math.min(until ?? phase.next_retry, phase.next_retry);
  return until;
}
