import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { ExitCode, KnowledgeKind, LessonListScenario } from "@titan/constants";
import { KnowledgeHub } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { LessonListSchema, type LessonRecord, LessonRecordSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

const zone = LessonRecordSchema.parse({
  persona: LessonListScenario.PersonaZone,
  step: LessonListScenario.StepZone,
  text: LessonListScenario.TextZone,
  run_id: LessonListScenario.Run,
  kept_at: LessonListScenario.ZoneAt,
});
const rounding = LessonRecordSchema.parse({
  persona: LessonListScenario.PersonaRound,
  step: LessonListScenario.StepRound,
  text: LessonListScenario.TextRound,
  run_id: LessonListScenario.RunNext,
  kept_at: LessonListScenario.RoundAt,
});
const newer = LessonRecordSchema.parse({
  persona: LessonListScenario.PersonaZone,
  step: LessonListScenario.StepZone,
  text: LessonListScenario.TextNewer,
  run_id: LessonListScenario.RunNext,
  kept_at: LessonListScenario.NewerAt,
});

function row(record: LessonRecord): string {
  return [record.persona, record.run_id, record.step, record.text].join(
    LessonListScenario.FieldJoin,
  );
}

export function lessonsBeforeDesign(
  words: string[],
  withNewer: boolean,
  extraBodies: string[],
): Promise<string> {
  return withTemporaryDirectory(async (directory) => {
    const home = resolve(directory, LessonListScenario.Home);
    const hub = await KnowledgeHub.open(home);
    try {
      const kept = withNewer ? [zone, rounding, newer] : [zone, rounding];
      for (const record of kept)
        await hub.add({
          kind: KnowledgeKind.Lesson,
          title: record.text,
          body: JSON.stringify(record),
          tags: [record.persona, record.step],
        });
      for (const body of extraBodies)
        await hub.add({ kind: KnowledgeKind.Lesson, title: LessonListScenario.TitleFree, body });
      let printed: unknown;
      const cli = createCli({
        ...defaultServices,
        knowledge: () => hub,
        output: (value) => {
          printed = value;
        },
      });
      const code = await cli([
        LessonListScenario.Command,
        ...words,
        LessonListScenario.HomeFlag,
        home,
        LessonListScenario.Json,
      ]);
      assert.equal(code, ExitCode.Success);
      return LessonListSchema.parse(printed).lessons.map(row).join(LessonListScenario.RowJoin);
    } finally {
      await hub.close();
    }
  });
}
