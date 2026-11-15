import { resolve } from "node:path";
import { PlanScenario } from "@titan/constants";
import { KnowledgeHub, planKeeper, topPlans } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { PlansReportSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

const persona = {
  description: PlanScenario.Description,
  role: PlanScenario.Role,
  model: PlanScenario.Model,
};

function plan() {
  return validateWorkflow({
    name: PlanScenario.Kind,
    goal: PlanScenario.Goal,
    personas: { [PlanScenario.Persona]: persona, [PlanScenario.Other]: persona },
    steps: [
      {
        id: PlanScenario.Step,
        do: { persona: PlanScenario.Persona, task: PlanScenario.Task },
        falsify: [{ persona: PlanScenario.Other, task: PlanScenario.Task }],
      },
    ],
  });
}

export function plansCommand(args: string[], codeFix: number[]): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const hub = await KnowledgeHub.open(resolve(root, PlanScenario.Home));
    try {
      const keep = planKeeper(hub);
      const kept = plan();
      for (const [index, reward] of codeFix.entries())
        await keep({
          kind: PlanScenario.Kind,
          run_id: `${PlanScenario.Runs}-${index}`,
          reward,
          plan: kept,
        });
      const output: unknown[] = [];
      const cli = createCli({
        ...defaultServices,
        knowledge: () => hub,
        output: (value) => {
          output.push(value);
        },
      });
      await cli(args);
      return PlansReportSchema.parse(output[0])
        .plans.map((entry) => entry.reward)
        .join(PlanScenario.Join);
    } finally {
      await hub.close();
    }
  });
}

export function plansBeforeDesign(
  codeFix: number[],
  research: number[],
  ask: string,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const hub = await KnowledgeHub.open(resolve(root, PlanScenario.Home));
    try {
      const keep = planKeeper(hub);
      const kept = plan();
      for (const [index, reward] of codeFix.entries())
        await keep({
          kind: PlanScenario.Kind,
          run_id: `${PlanScenario.Runs}-${index}`,
          reward,
          plan: kept,
        });
      for (const [index, reward] of research.entries())
        await keep({
          kind: PlanScenario.Other,
          run_id: `${PlanScenario.Runs}-${index}`,
          reward,
          plan: kept,
        });
      const report = await topPlans(hub, ask);
      return report.plans.length === 0
        ? PlanScenario.Empty
        : report.plans.map((entry) => entry.reward).join(PlanScenario.Join);
    } finally {
      await hub.close();
    }
  });
}
