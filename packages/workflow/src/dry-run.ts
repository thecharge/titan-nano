import type { AgentBudgetDefaults, Plan } from "@titan/types";

export function maxAgents(plan: Plan, defaults: AgentBudgetDefaults): number {
  return plan.nodes.reduce(
    (total, step) =>
      total +
      (step.candidates ?? defaults.candidates) *
        (step.max_attempts ?? defaults.max_attempts) *
        (1 + step.falsify.length) +
      (step.judge ? 1 : 0),
    0,
  );
}

export function stepRoom(plan: Plan, maxSteps: number): number {
  return Math.max(0, maxSteps - plan.nodes.length);
}
