import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { atomicWrite } from "@titan/board";
import { Improvement, Lesson, Newline, VerifyKind, WorkflowField } from "@titan/constants";
import { ImprovementMessage, LessonMessage } from "@titan/messages";
import type {
  ImprovementDecision,
  ImprovementOutcome,
  ImprovementRequest,
  Lesson as LessonProposal,
  Persona,
  PersonaEntry,
  Step,
  TaughtWorkflow,
  Workflow,
} from "@titan/types";

function scriptsOf(step: Step): string[] {
  const doing = WorkflowField.Script in step.do ? [step.do.script] : [];
  const falsifying = step.falsify.flatMap((entry) =>
    WorkflowField.Script in entry ? [entry.script] : [],
  );
  const verifying = step.verify.flatMap((entry) =>
    entry.kind === VerifyKind.Script ? [entry.run] : [],
  );
  return [...doing, ...step.checks, ...falsifying, ...verifying];
}

function falsifierScripts(step: Step): string[] {
  return step.falsify.flatMap((entry) => (WorkflowField.Script in entry ? [entry.script] : []));
}

function changedScript(old: readonly Step[], next: readonly Step[]): string | null {
  for (const step of next) {
    const prior = old.find((entry) => entry.id === step.id);
    const before = new Set(prior === undefined ? [] : scriptsOf(prior));
    if (scriptsOf(step).some((script) => !before.has(script)))
      return ImprovementMessage.ScriptChanged(step.id);
  }
  return null;
}

function weakerStep(old: readonly Step[], next: readonly Step[]): string | null {
  for (const step of old) {
    const after = next.find((entry) => entry.id === step.id);
    const kept = new Set(after === undefined ? [] : falsifierScripts(after));
    const weaker =
      after === undefined ||
      after.falsify.length < step.falsify.length ||
      falsifierScripts(step).some((script) => !kept.has(script));
    if (weaker) return ImprovementMessage.WeakerStep(step.id);
  }
  return null;
}

function worse(next: ImprovementOutcome, old: ImprovementOutcome): string | null {
  if (!next.passed) return ImprovementMessage.NotPassed;
  if (next.attempts > old.attempts)
    return ImprovementMessage.MoreAttempts(next.attempts, old.attempts);
  if (next.agents > old.agents) return ImprovementMessage.MoreAgents(next.agents, old.agents);
  return null;
}

async function nextVersion(directory: string, name: string): Promise<number> {
  const versions = (await readdir(directory)).flatMap((file) => {
    const match = Improvement.VersionPattern.exec(file);
    return match?.[1] === name ? [Number(match[2])] : [];
  });
  return Math.max(Improvement.FirstVersion - 1, ...versions) + 1;
}

function refused(reason: string): ImprovementDecision {
  return { file: null, reason, report: Improvement.NoReport };
}

function isInline(entry: PersonaEntry): entry is Persona {
  return !(WorkflowField.Use in entry) && !(WorkflowField.Mutates in entry);
}

function teach(workflow: Workflow, lessons: readonly LessonProposal[]): TaughtWorkflow {
  const personas = { ...workflow.personas };
  const applied: LessonProposal[] = [];
  for (const lesson of lessons) {
    const entry = personas[lesson.persona];
    if (entry !== undefined && isInline(entry)) {
      personas[lesson.persona] = { ...entry, role: [entry.role, lesson.text].join(Lesson.Join) };
      applied.push(lesson);
    }
  }
  return { workflow: { ...workflow, personas }, applied };
}

function commented(workflow: Workflow, applied: readonly LessonProposal[], runId: string): string {
  return Bun.YAML.stringify(workflow, null, Lesson.Indent)
    .split(Newline)
    .map((line) => {
      const lesson = applied.find((entry) => line.includes(entry.text));
      return lesson === undefined
        ? line
        : [line, LessonMessage.Comment(runId, lesson.step)].join(Lesson.Join);
    })
    .join(Newline);
}

export async function evaluateImprovement(
  request: ImprovementRequest,
): Promise<ImprovementDecision> {
  const scripted = changedScript(request.old.nodes, request.next.nodes);
  if (scripted !== null) return refused(scripted);
  const weaker = weakerStep(request.old.nodes, request.next.nodes);
  if (weaker !== null) return refused(weaker);
  const keeping = request.lessons;
  const taught = teach(
    request.next.workflow,
    keeping === undefined ? [] : (request.answer.lessons ?? []),
  );
  const next = { ...request.next, workflow: taught.workflow };
  const reason = worse(await request.rerun(next), request.previous);
  if (reason !== null) return refused(reason);
  const version = await nextVersion(request.directory, request.name);
  const file = `${request.name}${Improvement.VersionMarker}${version}${Improvement.FileExtension}`;
  const text =
    keeping !== undefined && taught.applied.length > 0
      ? commented(next.workflow, taught.applied, keeping.run_id)
      : Bun.YAML.stringify(next.workflow);
  await atomicWrite(resolve(request.directory, file), text);
  if (keeping !== undefined && taught.applied.length > 0)
    await keeping.keep({
      run_id: keeping.run_id,
      lessons: taught.applied,
      workflow: next.workflow,
    });
  const report = request.answer.changes
    .map((entry) => ImprovementMessage.Change(entry.change, entry.reason))
    .join(Newline);
  return { file, reason: null, report };
}
