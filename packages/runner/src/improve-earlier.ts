import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homePath } from "@titan/config";
import {
  ErrorCode,
  FileEncoding,
  ImproveLoop,
  Improver,
  RunFile,
  RunStatus,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { ScopedKnowledgeHub, scopedLessonKeeper } from "@titan/knowledge";
import { ImproveLoopMessage } from "@titan/messages";
import type {
  BackendFactory,
  ImprovementOutcome,
  ImproveReport,
  ImproveRequest,
  Plan,
  Run,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { Engine } from "./engine.ts";
import { improveLoop } from "./improve-loop.ts";
import { improveRun } from "./improver.ts";

async function outcomeOf(engine: Engine, run: Run): Promise<ImprovementOutcome> {
  const usage = await engine.usage(run.run_id);
  return {
    passed: run.state === RunStatus.Passed,
    attempts: Object.values(run.nodes).reduce((total, node) => total + node.attempt, 0),
    agents: usage.executions,
  };
}

function evaluated(plan: Plan, depth: number): Plan {
  const improve = plan.workflow.improve;
  return improve === undefined
    ? plan
    : validateWorkflow(
        {
          ...plan.workflow,
          improve: { ...improve, rounds: ImproveLoop.EvaluationRounds },
        },
        depth,
      );
}

export async function improveEarlier(
  factory: BackendFactory,
  request: ImproveRequest,
): Promise<ImproveReport> {
  const engine = new Engine(factory);
  const run = await engine.load(request.root);
  const improve = run.plan.workflow.improve;
  const rounds = request.rounds ?? improve?.rounds ?? 0;
  if (rounds < ImproveLoop.FirstRound)
    throw new TitanError(ErrorCode.Arguments, ImproveLoopMessage.RoundsMissing);
  const persona = request.persona ?? improve?.persona ?? Improver.DefaultPersona;
  const depth = run.config.value.limits.max_group_depth;
  const controller = new AbortController();
  const home = homePath(request.home);
  const hubs =
    improve?.lessons === true ? await ScopedKnowledgeHub.open(run.project, home) : undefined;
  try {
    return await improveLoop({
      ...(hubs === undefined
        ? {}
        : {
            lessons: {
              run_id: run.run_id,
              keep: scopedLessonKeeper(run.project, home, hubs, request.scope),
            },
          }),
      run_id: run.run_id,
      directory: run.project,
      name: run.plan.workflow.name,
      rounds,
      workflow: await readFile(resolve(run.root, RunFile.Workflow), FileEncoding.Utf8),
      start: run.plan,
      previous: await outcomeOf(engine, run),
      propose: (workflow) => improveRun(factory, run, controller.signal, { persona, workflow }),
      validate: (workflow) => validateWorkflow(Bun.YAML.parse(workflow), depth),
      rerun: async (plan) => {
        const evaluation = await engine.create({
          project: run.project,
          plan: evaluated(plan, depth),
          config: run.config,
          backend: run.backend,
          client_id: ImproveLoop.ClientId,
          submission_id: newId(),
        });
        await engine.start(evaluation.run_id);
        return outcomeOf(engine, evaluation);
      },
    });
  } finally {
    await hubs?.close();
  }
}
