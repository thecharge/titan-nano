import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  ImproveLoopScenario,
  Improvement,
  ImprovementScenario,
  ImproverScenario,
  type RunStatus,
  Verdict,
} from "@titan/constants";
import { Engine, improveEarlier } from "@titan/runner";
import { createRunClient } from "@titan/server/client";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ImproverRecordSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

function improveSetting(part: string) {
  if (part === ImproveLoopScenario.PartFull)
    return {
      improve: { persona: ImproverScenario.Improver, rounds: ImproveLoopScenario.ProjectRounds },
    };
  if (part === ImproveLoopScenario.PartRounds)
    return { improve: { rounds: ImproveLoopScenario.ProjectRounds } };
  return {};
}

function earlierWorkflow(part: string) {
  const persona = {
    description: ImproveLoopScenario.Description,
    role: ImproveLoopScenario.Role,
    model: ImproveLoopScenario.Model,
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
    ...improveSetting(part),
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

function fakeBackend(answer: string): FakeBackend {
  return new FakeBackend(async (spec, prompt) => {
    if (spec.persona_id === ImproverScenario.Improver)
      return {
        json: {
          workflow:
            answer === ImproveLoopScenario.AnswerBroken
              ? ImproveLoopScenario.Broken
              : ImproverRecordSchema.parse(JSON.parse(prompt)).workflow,
          changes: [{ change: ImproverScenario.Change, reason: ImproverScenario.Reason }],
        },
      };
    if (spec.persona_id === ImproverScenario.Fixer)
      return { json: { ok: true, marker: ImproverScenario.Marker } };
    return { json: { verdict: Verdict.Survived, evidence: ImproverScenario.Evidence } };
  });
}

export async function earlierRun(root: string, part: string, answer: string) {
  const home = resolve(root, ImproveLoopScenario.Home);
  const config = await resolveConfig({
    home,
    project: root,
    overrides: { recovery: { max_retries: 0 }, limits: { max_parallel: 2 } },
  });
  const backend = fakeBackend(answer);
  const factory = () => backend;
  const engine = new Engine(factory);
  const run = await engine.create({
    project: root,
    config,
    plan: earlierWorkflow(part),
    backend: Backend.Fake,
    client_id: ImproverScenario.Improver,
    submission_id: ImproverScenario.Improver,
  });
  await engine.start(run.run_id);
  return { home, run, factory };
}

export function improveCommand(
  part: string,
  answer: string,
  state: string,
  flags: readonly string[],
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const { home, run, factory } = await earlierRun(root, part, answer);
    const snapshot = {
      run_id: run.run_id,
      state: state as RunStatus,
      root: run.root,
      artifacts: null,
      nodes: {},
    };
    const lines: string[] = [];
    const main = createCli({
      ...defaultServices,
      output: (value) => {
        lines.push(String(value));
      },
      client: () => ({ ...createRunClient(home), get: async () => snapshot }),
      improve: (_home, request) => improveEarlier(factory, request),
    });
    await main([
      ImproveLoopScenario.Command,
      run.run_id,
      ImproveLoopScenario.HomeFlag,
      home,
      ...flags,
    ]);
    const kept = (await readdir(root)).filter((file) => Improvement.VersionPattern.test(file));
    return [lines.at(-1), kept.length].join(ImprovementScenario.Join);
  });
}
