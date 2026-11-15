import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ImproveLoopScenario, Improvement, ImprovementScenario } from "@titan/constants";
import { improveLoop } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { validateWorkflow } from "@titan/workflow";

function startPlan() {
  return validateWorkflow({
    name: ImprovementScenario.Name,
    goal: ImprovementScenario.Goal,
    personas: {
      [ImprovementScenario.Worker]: ImprovementScenario.Persona,
      [ImprovementScenario.Checker]: ImprovementScenario.Persona,
    },
    steps: [
      {
        id: ImprovementScenario.StepId,
        do: { persona: ImprovementScenario.Worker, task: ImprovementScenario.Task },
        falsify: [
          { persona: ImprovementScenario.Checker, task: ImprovementScenario.Check },
          { script: ImprovementScenario.BaseScript },
        ],
      },
    ],
  });
}

export function improveLoopRounds(
  rounds: number,
  attempts: readonly number[],
  valid: boolean,
): Promise<string> {
  return withTemporaryDirectory(async (directory) => {
    const start = startPlan();
    const text = Bun.YAML.stringify(start.workflow);
    await writeFile(
      resolve(directory, `${ImprovementScenario.Name}${Improvement.FileExtension}`),
      text,
    );
    let proposals = 0;
    let reruns = 0;
    const report = await improveLoop({
      run_id: ImproveLoopScenario.RunId,
      directory,
      name: ImprovementScenario.Name,
      rounds,
      workflow: text,
      start,
      previous: {
        passed: true,
        attempts: ImprovementScenario.OldAttempts,
        agents: ImprovementScenario.OldAgents,
      },
      propose: async () => {
        proposals++;
        return {
          workflow: valid ? text : ImproveLoopScenario.Broken,
          changes: [{ change: ImprovementScenario.Change, reason: ImprovementScenario.Reason }],
        };
      },
      validate: (workflow) => validateWorkflow(Bun.YAML.parse(workflow)),
      rerun: async () => {
        const next = Number(attempts[reruns]);
        reruns++;
        return { passed: true, attempts: next, agents: ImprovementScenario.BetterAgents };
      },
    });
    const files = (await readdir(directory)).sort().join(ImprovementScenario.ListJoin);
    return [
      proposals,
      reruns,
      files,
      report.kept,
      report.rounds.length,
      report.rounds
        .map((entry) => entry.file ?? ImprovementScenario.None)
        .join(ImprovementScenario.ListJoin),
    ].join(ImprovementScenario.Join);
  });
}
