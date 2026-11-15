import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  FileEncoding,
  Improver,
  KnowledgeKind,
  KnowledgeSearchMode,
  LessonScenario,
  Newline,
  Verdict,
} from "@titan/constants";
import { KnowledgeHub, lessonKeeper } from "@titan/knowledge";
import { LessonMessage } from "@titan/messages";
import { Engine, evaluateImprovement } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ImproverAnswerSchema,
  type ImproverRecord,
  ImproverRecordSchema,
  type Lesson,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

function lessonWorkflow(lessons: boolean) {
  const persona = { ...LessonScenario.Persona, tools: [AgentTool.Read] };
  return validateWorkflow({
    name: LessonScenario.PlanName,
    goal: LessonScenario.Goal,
    personas: {
      [LessonScenario.Investigator]: {
        ...persona,
        outputs: { ok: { type: "boolean" }, marker: { type: "string" } },
      },
      [LessonScenario.Skeptic]: persona,
      [LessonScenario.Improver]: persona,
    },
    improve: { persona: LessonScenario.Improver, rounds: LessonScenario.One, lessons },
    steps: [
      {
        id: LessonScenario.Step,
        do: { persona: LessonScenario.Investigator, task: LessonScenario.Task },
        falsify: [{ persona: LessonScenario.Skeptic, task: LessonScenario.Check }],
        max_attempts: LessonScenario.Attempts,
      },
    ],
  });
}

function proposed(record: ImproverRecord, ghost: boolean): Lesson[] {
  if (record.lessons !== true) return [];
  const refuted = record.steps.filter(
    (step) =>
      step.refutations >= LessonScenario.Attempts &&
      step.evidence.some((entry) => entry.includes(LessonScenario.EvidenceWord)),
  );
  return refuted.flatMap((step) => [
    { persona: LessonScenario.Investigator, step: step.id, text: LessonScenario.Text },
    ...(ghost
      ? [{ persona: LessonScenario.Ghost, step: step.id, text: LessonScenario.GhostText }]
      : []),
  ]);
}

async function lessonLines(directory: string, file: string | null): Promise<string[]> {
  if (file === null) return [];
  return (await readFile(resolve(directory, file), FileEncoding.Utf8)).split(Newline);
}

export function lessonFromRefutation(
  lessons: boolean,
  passed: boolean,
  ghost: boolean,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const config = await resolveConfig({
      home: resolve(root, LessonScenario.Home),
      project: root,
      overrides: { recovery: { max_retries: 0 }, limits: { max_parallel: 2 } },
    });
    let refuted = false;
    const backend = new FakeBackend(async (spec, prompt) => {
      if (spec.persona_id === LessonScenario.Improver) {
        const record = ImproverRecordSchema.parse(JSON.parse(prompt));
        refuted = record.steps.some((step) => step.refutations >= LessonScenario.Attempts);
        return {
          json: {
            workflow: LessonScenario.PlanName,
            changes: [],
            lessons: proposed(record, ghost),
          },
        };
      }
      if (spec.persona_id === LessonScenario.Investigator)
        return { json: { ok: true, marker: LessonScenario.Marker } };
      return { json: { verdict: Verdict.Refuted, evidence: LessonScenario.Evidence } };
    });
    const engine = new Engine(() => backend);
    const plan = lessonWorkflow(lessons);
    const run = await engine.create({
      project: root,
      config,
      plan,
      backend: Backend.Fake,
      client_id: LessonScenario.Client,
      submission_id: LessonScenario.Client,
    });
    await engine.start(run.run_id);
    const answer = ImproverAnswerSchema.parse(
      JSON.parse(await readFile(resolve(run.root, Improver.Output), FileEncoding.Utf8)),
    );
    const hubHome = resolve(root, LessonScenario.Hub);
    const hub = await KnowledgeHub.open(hubHome);
    try {
      await hub.registerPersonas(run.plan.workflow);
      await hub.reindex();
      const decision = await evaluateImprovement({
        directory: root,
        name: LessonScenario.PlanName,
        old: run.plan,
        next: run.plan,
        answer,
        ...(run.plan.workflow.improve?.lessons === true
          ? { lessons: { run_id: run.run_id, keep: lessonKeeper(hubHome, hub) } }
          : {}),
        previous: {
          passed: true,
          attempts: LessonScenario.Attempts,
          agents: LessonScenario.Attempts,
        },
        rerun: async () => ({
          passed,
          attempts: LessonScenario.One,
          agents: LessonScenario.One,
        }),
      });
      await hub.reindex();
      const lines = await lessonLines(root, decision.file);
      const comment = LessonMessage.Comment(run.run_id, LessonScenario.Step);
      const commentHeld = lines.some(
        (line) => line.includes(LessonScenario.Text) && line.includes(comment),
      );
      const found = await hub.search({
        question: LessonScenario.Query,
        mode: KnowledgeSearchMode.Words,
        kind: KnowledgeKind.Lesson,
      });
      const personas = await hub.search({
        mode: KnowledgeSearchMode.Words,
        kind: KnowledgeKind.Persona,
      });
      const personaHits = await hub.search({
        question: LessonScenario.Query,
        mode: KnowledgeSearchMode.Words,
        kind: KnowledgeKind.Persona,
      });
      return [
        decision.file ?? LessonScenario.None,
        decision.reason ?? LessonScenario.None,
        commentHeld,
        refuted,
        found.results.length,
        personas.results.length,
        personaHits.results.length,
      ].join(LessonScenario.Join);
    } finally {
      await hub.close();
    }
  });
}
