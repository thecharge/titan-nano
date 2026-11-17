import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { atomicWrite } from "@titan/board";
import { FileEncoding, Improver, ImproverOutput, RunFile, StepStatus } from "@titan/constants";
import {
  type BackendFactory,
  type ImproveRunOptions,
  type ImproverAnswer,
  ImproverAnswerSchema,
  type ImproverRecord,
  type NativeToolExecution,
  type Run,
} from "@titan/types";
import { resolvedPersona } from "@titan/workflow";
import { personaBackend } from "./backend-choice.ts";
import { effectiveModel } from "./models.ts";
import { skillRole } from "./skill-role.ts";

function improverRecord(run: Run, workflow: string): ImproverRecord {
  return {
    workflow,
    steps: run.plan.nodes.map((step) => {
      const node = run.nodes[step.id];
      return {
        id: step.id,
        state: node?.state ?? StepStatus.Pending,
        attempt: node?.attempt ?? 1,
        refutations: node?.refutations ?? 0,
        evidence: node?.evidence ?? [],
      };
    }),
    ...(run.plan.workflow.improve?.lessons === true ? { lessons: true } : {}),
  };
}

function improverTask(run: Run, workflow: string): string {
  return JSON.stringify(improverRecord(run, workflow));
}

export function improvementRounds(run: Run): number {
  return run.plan.workflow.improve?.rounds ?? 0;
}

export async function improveRun(
  factory: BackendFactory,
  run: Run,
  signal: AbortSignal,
  options: ImproveRunOptions = {},
  tools?: NativeToolExecution,
): Promise<ImproverAnswer> {
  const name = options.persona ?? run.plan.workflow.improve?.persona ?? Improver.DefaultPersona;
  const persona = resolvedPersona(run.plan.workflow, name);
  const workflow =
    options.workflow ?? (await readFile(resolve(run.root, RunFile.Workflow), FileEncoding.Utf8));
  const role = skillRole(run, persona);
  const prompt = improverTask(run, workflow);
  await tools?.guard({ role, prompt });
  const backend = factory(personaBackend(run, persona), run.config);
  const session = await backend.start(
    {
      persona_id: name,
      run_id: run.run_id,
      invocation_id: Improver.InvocationId,
      execution_id: tools?.binding.connection.scope.execution_id ?? Improver.ExecutionId,
      cwd: run.root,
      role,
      model: effectiveModel(persona, run.config.value.defaults),
      tools: persona.tools,
      output_schema: ImproverOutput,
      writable: false,
      max_turns: run.config.value.defaults.claude_max_turns,
    },
    tools?.binding,
  );
  try {
    const answer = await session.send(prompt, async (event) => tools?.guard(event), signal);
    const parsed = ImproverAnswerSchema.parse(answer.json);
    await tools?.guard(parsed);
    await atomicWrite(resolve(run.root, Improver.Output), JSON.stringify(parsed, null, 2));
    return parsed;
  } finally {
    await session.close();
  }
}
