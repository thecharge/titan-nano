import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { boardPosts, boardStepAdds, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { AddStepFixture, Backend, BoardPostKind, HiveFixture } from "@titan/constants";
import { RunnerMessage } from "@titan/messages";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type AddStepsObserved, StepSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

async function observeAddSteps(
  root: string,
  count: number,
  falsifier: boolean,
  survives: boolean,
): Promise<AddStepsObserved> {
  const config = await resolveConfig({ home: resolve(root, "home"), project: root });
  const engine = new Engine(() => new FakeBackend());
  const run = await engine.create({
    project: root,
    config,
    plan: validateWorkflow(vendorRecoveryWorkflow(HiveFixture.CheckTask)),
    backend: Backend.Fake,
    client_id: HiveFixture.ClientId,
    submission_id: HiveFixture.ClientId,
  });
  const steps = Array.from({ length: count }, (_, index) =>
    StepSchema.parse({
      id: `${HiveFixture.ExtraPrefix}${index}`,
      do: { persona: HiveFixture.Worker, task: HiveFixture.ExtraTask },
      falsify: falsifier ? [{ persona: HiveFixture.Checker, task: HiveFixture.CheckTask }] : [],
    }),
  );
  await engine.addSteps(run.run_id, steps, AddStepFixture.Sender, async () => survives);
  const store = new RunStore(run.root);
  const posts = await boardPosts(store.events());
  const adds = await boardStepAdds(store.events());
  return {
    steps: run.plan.nodes.length,
    added_by: adds.map((line) => line.added_by),
    refused: posts.filter(
      (post) => post.kind === BoardPostKind.Refused && post.text === RunnerMessage.NoFalsifier,
    ).length,
    dropped: posts.filter((post) => post.kind === BoardPostKind.Dropped).length,
  };
}

export async function addStepsScenario(
  count: number,
  falsifier: boolean,
  survives: boolean,
): Promise<string> {
  const seen = await withTemporaryDirectory((root) =>
    observeAddSteps(root, count, falsifier, survives),
  );
  return [seen.steps, seen.added_by.join(AddStepFixture.Joiner), seen.refused, seen.dropped].join(
    AddStepFixture.Divider,
  );
}
