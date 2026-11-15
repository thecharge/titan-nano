import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import { AgentTool, Backend, RunStatus, SplitScenario, Verdict } from "@titan/constants";
import { Engine } from "@titan/runner";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { SplitObserved } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

const role = {
  description: SplitScenario.Description,
  role: SplitScenario.Role,
  model: SplitScenario.Model,
};

function splitWorkflow(width: number) {
  const split = {
    parts: SplitScenario.Parts,
    ...(width === SplitScenario.Unset ? {} : { width }),
  };
  return validateWorkflow({
    name: "Split work",
    goal: "Edit every planned file",
    personas: {
      [SplitScenario.Planner]: {
        ...role,
        tools: [AgentTool.Read, AgentTool.Write],
        outputs: { files: {} },
      },
      [SplitScenario.Editor]: { ...role, tools: [AgentTool.Read, AgentTool.Write] },
      [SplitScenario.Checker]: { ...role, tools: [AgentTool.Read] },
    },
    graph: {
      nodes: [
        {
          id: SplitScenario.PlanStep,
          needs: [],
          do: { persona: SplitScenario.Planner, task: SplitScenario.PlanTask },
          falsify: [{ persona: SplitScenario.Checker, task: SplitScenario.CheckTask }],
        },
        {
          id: SplitScenario.EditStep,
          needs: [SplitScenario.PlanStep],
          do: { persona: SplitScenario.Editor, task: SplitScenario.EditTask },
          split,
          falsify: [{ persona: SplitScenario.Checker, task: SplitScenario.CheckTask }],
        },
      ],
    },
  });
}

async function splitAtRoot(
  root: string,
  items: number,
  width: number,
  maxParallel: number,
): Promise<SplitObserved> {
  const config = await resolveConfig({
    home: resolve(root, "home"),
    project: root,
    overrides: { recovery: { max_retries: 0 }, limits: { max_parallel: maxParallel } },
  });
  const observed: SplitObserved = { workers: 0, active: 0, peak: 0, state: RunStatus.Running };
  const concurrent = Math.min(items, width || maxParallel, maxParallel);
  const backend = new FakeBackend(async (spec) => {
    if (spec.persona_id === SplitScenario.Planner)
      return {
        json: {
          files:
            items < 0
              ? SplitScenario.NotList
              : Array.from({ length: items }, (_, index) => `${SplitScenario.FilePrefix}${index}`),
        },
      };
    if (spec.persona_id === SplitScenario.Checker)
      return { json: { verdict: Verdict.Survived, evidence: SplitScenario.Evidence } };
    observed.workers++;
    observed.active++;
    observed.peak = Math.max(observed.peak, observed.active);
    const batch = Math.min(items, Math.ceil(observed.workers / concurrent) * concurrent);
    assert(await waitUntil(async () => observed.workers >= batch));
    observed.active--;
    return { json: { done: true } };
  });
  const engine = new Engine(() => backend);
  const run = await engine.create({
    project: root,
    config,
    plan: splitWorkflow(width),
    backend: Backend.Fake,
    client_id: SplitScenario.ClientId,
    submission_id: SplitScenario.ClientId,
  });
  await engine.start(run.run_id);
  assert.equal(observed.active, 0);
  observed.state = run.state;
  return observed;
}

export async function splitWidth(
  items: number,
  width: number,
  maxParallel: number,
): Promise<string> {
  const observed = await withTemporaryDirectory((root) =>
    splitAtRoot(root, items, width, maxParallel),
  );
  return `${observed.workers} ${observed.peak} ${observed.state}`;
}
