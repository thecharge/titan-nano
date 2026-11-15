import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  DataKind,
  ExecutionPhase,
  LimitAction,
  LimitFixture,
  LimitTest,
  RunStatus,
} from "@titan/constants";
import { all } from "@titan/core";
import { Engine } from "@titan/runner";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type BackendFactory, type LimitBudget, ObjectSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { schemaFakeAnswer } from "../support/backend.ts";

function limitWorkflow() {
  const base = vendorRecoveryWorkflow(LimitTest.Review);
  const falsify = [{ persona: LimitTest.Checker, task: LimitTest.Review }];
  return {
    ...base,
    steps: [
      {
        id: LimitTest.FirstStep,
        do: { persona: LimitTest.Worker, task: LimitTest.First },
        falsify,
      },
      {
        id: LimitTest.SecondStep,
        do: { persona: LimitTest.Worker, task: LimitTest.Second },
        falsify,
      },
    ],
  };
}

function limitBackend(calls: string[][], id: string, limits: LimitBudget): FakeBackend {
  return new FakeBackend(async (spec, prompt) => {
    const task = String(ObjectSchema.parse(JSON.parse(prompt)).task);
    if (task === LimitTest.First || task === LimitTest.Second) calls.push([id, task]);
    if (task === LimitTest.Second && limits.remaining > 0) {
      limits.remaining--;
      return { text: LimitTest.Text, json: null };
    }
    return schemaFakeAnswer(spec);
  });
}

function clockFor(fixture: LimitFixture): () => Date {
  const fields = fixture === LimitFixture.Far ? LimitTest.FarClock : LimitTest.NearClock;
  return () => new Date(LimitTest.Year, LimitTest.Month, LimitTest.Day, ...fields);
}

export async function limitRun(fixture: LimitFixture, action: LimitAction) {
  return withTemporaryDirectory(async (root) => {
    const project = join(root, "project");
    const home = join(root, "home");
    await all([() => mkdir(project), () => mkdir(home)]);
    await writeFile(join(project, "source.txt"), Buffer.from("Original project content"));
    const calls: string[][] = [];
    const limits = { remaining: fixture === LimitFixture.Clear ? 0 : 1 };
    const factory: BackendFactory = (id) =>
      limitBackend(calls, id, id === Backend.Codex ? { remaining: 0 } : limits);
    const engine = new Engine(factory, {}, { clock: clockFor(fixture) });
    const run = await engine.create({
      project,
      plan: validateWorkflow(limitWorkflow()),
      config: await resolveConfig({ home, project }),
      backend: Backend.Claude,
      client_id: LimitTest.Client,
      submission_id: LimitTest.Submission,
    });
    const before = Date.now();
    await engine.start(run.run_id);
    const second = run.nodes[LimitTest.SecondStep];
    const retry = second?.phases[ExecutionPhase.Worker]?.next_retry ?? null;
    const observed = {
      state: run.state,
      error: run.error,
      step: second?.state,
      retry:
        retry !== null &&
        retry > before &&
        retry <= before + LimitTest.NearMilliseconds + LimitTest.RetrySlackMilliseconds,
    };
    if (action === LimitAction.Wait)
      await waitUntil(
        async () => run.state === RunStatus.Passed,
        fixture === LimitFixture.Far ? LimitTest.FarWaitAttempts : LimitTest.WaitAttempts,
      );
    if (action === LimitAction.Resume) await engine.resume(run.run_id);
    if (action === LimitAction.Switch) await engine.resume(run.run_id, Backend.Codex);
    const finalState = run.state;
    await engine.cancel(run.run_id);
    return { ...observed, finalState, calls };
  });
}

export async function cliResume(args: string[], nodes: Record<string, unknown>) {
  return withTemporaryDirectory(async (home) => {
    const seen: unknown[][] = [];
    const outputs: unknown[] = [];
    const cli = createCli({
      ...defaultServices,
      client: (address) => ({
        ...createRunClient(address),
        control: async (id, action, backend) => {
          seen.push([id, action, backend]);
          return {
            run_id: id,
            state: RunStatus.Running,
            root: "/kept/run",
            artifacts: null,
            nodes,
          };
        },
      }),
      output: (value) => outputs.push(value),
    });
    await cli([...args, "--home", home]);
    return { seen, messages: outputs.filter((value) => typeof value === DataKind.String) };
  });
}
