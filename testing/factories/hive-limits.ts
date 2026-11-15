import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { boardPosts, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, BoardPostKind, HiveFixture, RequestKind } from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type RunawayObserved, StepSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

async function observeRunaway(
  root: string,
  maxSteps: number,
  tries: number,
): Promise<RunawayObserved> {
  const config = await resolveConfig({
    home: resolve(root, "home"),
    project: root,
    overrides: { limits: { max_steps: maxSteps } },
  });
  const backend = new FakeBackend();
  const engine = new Engine(() => backend);
  const run = await engine.create({
    project: root,
    config,
    plan: validateWorkflow(vendorRecoveryWorkflow(HiveFixture.CheckTask)),
    backend: Backend.Fake,
    client_id: HiveFixture.ClientId,
    submission_id: HiveFixture.ClientId,
  });
  for (let index = 0; index < tries; index++)
    await engine.addStep(
      run.run_id,
      StepSchema.parse({
        id: `${HiveFixture.ExtraPrefix}${index}`,
        do: { persona: HiveFixture.Worker, task: HiveFixture.ExtraTask },
      }),
      HiveFixture.Worker,
    );
  const posts = await boardPosts(new RunStore(run.root).events());
  const requests = await engine.requests.list(run.run_id);
  return {
    steps: run.plan.nodes.length,
    refused: posts.filter((post) => post.kind === BoardPostKind.Refused).length,
    open: requests.filter(
      (request) => request.kind === RequestKind.RaiseLimit && request.answer === null,
    ).length,
  };
}

export async function runawayAgent(maxSteps: number, tries: number): Promise<string> {
  const seen = await withTemporaryDirectory((root) => observeRunaway(root, maxSteps, tries));
  return `${seen.steps} ${seen.refused} ${seen.open}`;
}
