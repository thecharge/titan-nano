import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Improvement, ImprovementScenario, ImprovementVariant, VerifyKind } from "@titan/constants";
import { evaluateImprovement } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { ImprovementOutcome } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

const checker = { persona: ImprovementScenario.Checker, task: ImprovementScenario.Check };
const baseScript = { script: ImprovementScenario.BaseScript };
const injected = { script: ImprovementScenario.InjectedScript };
const worker = { persona: ImprovementScenario.Worker, task: ImprovementScenario.Task };

function doing(variant: string, isNew: boolean) {
  if (variant === ImprovementVariant.ChangeDoScript) return isNew ? injected : baseScript;
  if (variant === ImprovementVariant.AddDoScript && isNew) return injected;
  return worker;
}

function falsifying(variant: string) {
  if (variant === ImprovementVariant.DropScriptFalsifier) return [checker];
  if (variant === ImprovementVariant.DropFalsifier) return [baseScript];
  if (variant === ImprovementVariant.AddFalsifier) return [checker, checker, baseScript];
  if (variant === ImprovementVariant.AddFalsifyScript) return [checker, baseScript, injected];
  return [checker, baseScript];
}

function stepOf(variant: string, isNew: boolean) {
  const changed = isNew ? variant : ImprovementVariant.Same;
  const verify =
    changed === ImprovementVariant.AddVerifyScript
      ? [{ kind: VerifyKind.Script, run: ImprovementScenario.InjectedScript, deterministic: true }]
      : [];
  return {
    id: ImprovementScenario.StepId,
    do: doing(variant, isNew),
    falsify: falsifying(changed),
    verify,
  };
}

function planOf(variant: string, isNew: boolean) {
  return validateWorkflow({
    name: ImprovementScenario.Name,
    goal: ImprovementScenario.Goal,
    personas: {
      [ImprovementScenario.Worker]: ImprovementScenario.Persona,
      [ImprovementScenario.Checker]: ImprovementScenario.Persona,
    },
    steps: [stepOf(variant, isNew)],
  });
}

function evaluated(variant: string, outcome: ImprovementOutcome): Promise<string> {
  return withTemporaryDirectory(async (directory) => {
    const old = planOf(variant, false);
    await writeFile(
      resolve(directory, `${ImprovementScenario.Name}${Improvement.FileExtension}`),
      Bun.YAML.stringify(old.workflow),
    );
    let reruns = 0;
    const decision = await evaluateImprovement({
      directory,
      name: ImprovementScenario.Name,
      old,
      next: planOf(variant, true),
      answer: {
        workflow: ImprovementScenario.Name,
        changes: [{ change: ImprovementScenario.Change, reason: ImprovementScenario.Reason }],
      },
      previous: {
        passed: true,
        attempts: ImprovementScenario.OldAttempts,
        agents: ImprovementScenario.OldAgents,
      },
      rerun: async () => {
        reruns++;
        return outcome;
      },
    });
    const files = (await readdir(directory)).sort().join(ImprovementScenario.ListJoin);
    return [
      decision.file ?? ImprovementScenario.None,
      decision.reason ?? ImprovementScenario.None,
      reruns,
      files,
      decision.report,
    ].join(ImprovementScenario.Join);
  });
}

export function improverRemovesFalsifier(variant: string): Promise<string> {
  return evaluated(variant, {
    passed: true,
    attempts: ImprovementScenario.BetterAttempts,
    agents: ImprovementScenario.BetterAgents,
  });
}

export function improverAddsScript(variant: string): Promise<string> {
  return evaluated(variant, {
    passed: true,
    attempts: ImprovementScenario.BetterAttempts,
    agents: ImprovementScenario.BetterAgents,
  });
}

export function newFileBetter(attempts: number, agents: number): Promise<string> {
  return evaluated(ImprovementVariant.Same, { passed: true, attempts, agents });
}

export function newFileWorse(attempts: number, agents: number, passed: boolean): Promise<string> {
  return evaluated(ImprovementVariant.Same, { passed, attempts, agents });
}
