import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  LongGraphFixture,
  RunStatus,
  Verdict,
  WorkspaceModeSetting,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { validateWorkflow } from "@titan/workflow";
import { completeGraph } from "./long-graph.ts";

export async function graphBudget(worker: boolean, expired: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const release = Promise.withResolvers<void>();
    let entered = false;
    let active = 0;
    const backend = new FakeBackend(async (spec, _prompt, signal) => {
      active++;
      const stop = () => release.resolve();
      try {
        if (spec.writable === worker) {
          signal.addEventListener("abort", stop, { once: true });
          entered = true;
          await release.promise;
        }
        return {
          json: spec.writable
            ? { ok: true, marker: "budget", turn: 1 }
            : { verdict: Verdict.Survived, evidence: "Completed check" },
        };
      } finally {
        signal.removeEventListener("abort", stop);
        active--;
      }
    });
    const engine = new Engine(() => backend);
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      backend: Backend.Fake,
      client_id: "budget",
      submission_id: "bounded-graph",
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: { workspace: { mode: WorkspaceModeSetting.Isolated } },
      }),
    });
    const work = engine.start(run.run_id);
    try {
      assert.ok(await waitUntil(async () => entered));
      if (!expired) release.resolve();
      const error = await thrownBy(() =>
        completeGraph(
          engine,
          run,
          expired
            ? LongGraphFixture.CancellationMilliseconds
            : LongGraphFixture.ControlMilliseconds,
        ),
      );
      if (expired) {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Mixed graph exceeded its execution budget");
      } else assert.equal(error, undefined);
      assert.equal(run.state, expired ? RunStatus.Cancelled : RunStatus.Passed);
      assert.equal(run.nodes.deliver?.refutations, 0);
      assert.equal(active, 0);
      await work;
      return true;
    } finally {
      release.resolve();
      await engine.cancel(run.run_id);
      await work;
    }
  });
}
