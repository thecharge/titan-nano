import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  KnowledgeFile,
  KnowledgeKind,
  type KnowledgeScope,
  LessonScenario,
  Verdict,
} from "@titan/constants";
import { projectHubPath } from "@titan/knowledge";
import { Engine, improveEarlier } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ImproverRecordSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

function projectWorkflow(lessons: boolean) {
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

async function lessonFiles(directory: string): Promise<number> {
  const names = await readdir(directory).catch(() => []);
  return names.length;
}

export function runSavesLesson(
  scope: KnowledgeScope,
  lessons: boolean,
  passes: boolean,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, LessonScenario.Home);
    const config = await resolveConfig({
      home,
      project: root,
      overrides: { recovery: { max_retries: 0 }, limits: { max_parallel: 2 } },
    });
    let original = LessonScenario.None as string;
    const backend = new FakeBackend(async (spec, prompt) => {
      if (spec.persona_id === LessonScenario.Improver) {
        const record = ImproverRecordSchema.parse(JSON.parse(prompt));
        return {
          json: {
            workflow: record.workflow,
            changes: [],
            lessons:
              record.lessons === true
                ? [
                    {
                      persona: LessonScenario.Investigator,
                      step: LessonScenario.Step,
                      text: LessonScenario.Text,
                    },
                  ]
                : [],
          },
        };
      }
      if (spec.persona_id === LessonScenario.Investigator)
        return { json: { ok: true, marker: LessonScenario.Marker } };
      const survives = passes && spec.run_id !== original;
      return {
        json: {
          verdict: survives ? Verdict.Survived : Verdict.Refuted,
          evidence: LessonScenario.Evidence,
        },
      };
    });
    const engine = new Engine(() => backend);
    const run = await engine.create({
      project: root,
      config,
      plan: projectWorkflow(lessons),
      backend: Backend.Fake,
      client_id: LessonScenario.Client,
      submission_id: LessonScenario.Client,
    });
    original = run.run_id;
    await engine.start(run.run_id);
    await improveEarlier(() => backend, { root: run.root, home, scope });
    const inProject = await lessonFiles(join(projectHubPath(root), KnowledgeKind.Lesson));
    const inHome = await lessonFiles(join(home, KnowledgeFile.Directory, KnowledgeKind.Lesson));
    return [inProject, inHome].join(LessonScenario.Join);
  });
}
