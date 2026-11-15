import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import { AgentTool, Backend, RunEventKind, StepStart, Verdict } from "@titan/constants";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ObjectSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

function stepOf(data: unknown): unknown {
  return ObjectSchema.parse(data ?? {}).step_id;
}

function nodeFor(id: string, needs: string[], inputs: Record<string, string>) {
  const fix = id === StepStart.Fix;
  return {
    id,
    needs,
    inputs,
    do: {
      persona: fix ? StepStart.FixPersona : StepStart.CausePersona,
      task: fix ? StepStart.FixTask : StepStart.CauseTask,
    },
    falsify: [{ persona: StepStart.SkepticPersona, task: StepStart.CheckTask }],
  };
}

function startWorkflow(producers: string[], side: boolean) {
  const inputs = Object.fromEntries(
    producers.map((id) => [id, `${id}.${StepStart.RootCause}`] as const),
  );
  const formats = Object.fromEntries(producers.map((id) => [id, StepStart.StringFormat] as const));
  const independent = [...producers, ...(side ? [StepStart.Side] : [])];
  return validateWorkflow({
    name: StepStart.WorkflowName,
    goal: StepStart.WorkflowGoal,
    personas: {
      [StepStart.CausePersona]: {
        description: StepStart.CauseTask,
        role: StepStart.CauseTask,
        tools: [AgentTool.Write],
        outputs: { [StepStart.RootCause]: StepStart.StringFormat },
      },
      [StepStart.FixPersona]: {
        description: StepStart.FixTask,
        role: StepStart.FixTask,
        tools: [AgentTool.Write],
        inputs: formats,
      },
      [StepStart.SkepticPersona]: {
        description: StepStart.CheckTask,
        role: StepStart.CheckTask,
      },
    },
    graph: {
      nodes: [
        ...independent.map((id) => nodeFor(id, [], {})),
        nodeFor(StepStart.Fix, producers, inputs),
      ],
    },
  });
}

function startBackend(refuted: string[]): FakeBackend {
  return new FakeBackend(async (spec) => {
    const id = spec.invocation_id.split("/")[0] ?? "";
    if (spec.writable) return { json: { [StepStart.RootCause]: StepStart.CauseValue } };
    return {
      json: refuted.includes(id)
        ? { verdict: Verdict.Refuted, evidence: StepStart.Flaw }
        : { verdict: Verdict.Survived, evidence: StepStart.Evidence },
    };
  });
}

export async function stepStart(
  producers: string[],
  refuted: string[],
  side: boolean,
): Promise<string> {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(() => startBackend(refuted));
    const run = await engine.create({
      project,
      plan: startWorkflow(producers, side),
      config: await resolveConfig({
        home: resolve(project, StepStart.Home),
        project,
        overrides: { defaults: { max_attempts: 1 } },
      }),
      backend: Backend.Fake,
      client_id: StepStart.Client,
      submission_id: StepStart.Client,
    });
    await engine.start(run.run_id);
    const events = (await engine.events(run.run_id)).events;
    const starts = events.filter(
      (event) => event.type === RunEventKind.AttemptStarted && stepOf(event.data) === StepStart.Fix,
    );
    const first = events.findIndex(
      (event) => event.type === RunEventKind.AttemptStarted && stepOf(event.data) === StepStart.Fix,
    );
    const passes = events.flatMap((event, index) =>
      event.type === RunEventKind.StepPassed && producers.includes(String(stepOf(event.data)))
        ? [index]
        : [],
    );
    const last = Math.max(...passes);
    const after = first >= 0 && passes.length === producers.length && last < first;
    const waited = after
      ? events
          .slice(last + 1, first)
          .filter(
            (event) =>
              event.type === RunEventKind.StepPassed &&
              producers.includes(String(stepOf(event.data))),
          ).length
      : 0;
    return `${starts.length} ${after} ${waited}`;
  });
}
