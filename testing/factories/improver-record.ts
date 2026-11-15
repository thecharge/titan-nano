import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  FileEncoding,
  Improver,
  ImproverScenario,
  Verdict,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ImproverAnswerSchema, type ImproverObserved, ImproverRecordSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { exists } from "@titan/workspace";

function improverWorkflow(rounds: number | undefined) {
  const persona = {
    description: "Persona",
    role: "Contract role",
    model: "stub-model",
    tools: [AgentTool.Read],
  };
  return validateWorkflow({
    name: ImproverScenario.Name,
    goal: ImproverScenario.Goal,
    personas: {
      [ImproverScenario.Fixer]: {
        ...persona,
        outputs: { ok: { type: "boolean" }, marker: { type: "string" } },
      },
      [ImproverScenario.Skeptic]: persona,
      [ImproverScenario.Improver]: persona,
    },
    ...(rounds === undefined ? {} : { improve: { persona: ImproverScenario.Improver, rounds } }),
    steps: [
      {
        id: ImproverScenario.StepId,
        do: { persona: ImproverScenario.Fixer, task: ImproverScenario.FixTask },
        falsify: [{ persona: ImproverScenario.Skeptic, task: ImproverScenario.CheckTask }],
        max_attempts: ImproverScenario.Attempts,
      },
    ],
  });
}

async function observeAt(
  root: string,
  rounds: number | undefined,
  refute: boolean,
): Promise<ImproverObserved> {
  const config = await resolveConfig({
    home: resolve(root, "home"),
    project: root,
    overrides: { recovery: { max_retries: 0 }, limits: { max_parallel: 2 } },
  });
  const tasks: string[] = [];
  let fixerPrompts = 0;
  const backend = new FakeBackend(async (spec, prompt) => {
    if (spec.persona_id === ImproverScenario.Improver) {
      tasks.push(prompt);
      return {
        json: {
          workflow: ImproverScenario.Replacement,
          changes: [{ change: ImproverScenario.Change, reason: ImproverScenario.Reason }],
        },
      };
    }
    if (spec.persona_id === ImproverScenario.Fixer) {
      fixerPrompts++;
      return { json: { ok: true, marker: ImproverScenario.Marker } };
    }
    return {
      json: refute
        ? { verdict: Verdict.Refuted, evidence: ImproverScenario.Evidence }
        : { verdict: Verdict.Survived, evidence: ImproverScenario.Evidence },
    };
  });
  const engine = new Engine(() => backend);
  const run = await engine.create({
    project: root,
    config,
    plan: improverWorkflow(rounds),
    backend: Backend.Fake,
    client_id: ImproverScenario.Improver,
    submission_id: ImproverScenario.Improver,
  });
  await engine.start(run.run_id);
  const file = resolve(run.root, Improver.Output);
  const saved = (await exists(file))
    ? ImproverAnswerSchema.parse(JSON.parse(await readFile(file, FileEncoding.Utf8)))
    : null;
  return { tasks, fixerPrompts, state: run.state, saved };
}

export function improverRecord(rounds: number | undefined, refute: boolean): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const observed = await observeAt(root, rounds, refute);
    const first = observed.tasks[0];
    const record = first === undefined ? null : ImproverRecordSchema.parse(JSON.parse(first));
    const step = record?.steps.find((entry) => entry.id === ImproverScenario.StepId);
    const workflowHeld = record?.workflow.includes(ImproverScenario.Name) === true;
    const attemptsHeld = step !== undefined && step.attempt === observed.fixerPrompts;
    const evidenceHeld = step?.evidence.includes(ImproverScenario.Evidence) === true;
    const outcome = step?.state ?? null;
    return `${observed.tasks.length} ${workflowHeld} ${attemptsHeld} ${evidenceHeld} ${outcome} ${observed.state} ${observed.saved !== null}`;
  });
}
