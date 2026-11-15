import { resolve } from "node:path";
import { GuideExamples } from "@titan/constants";
import { all } from "@titan/core";
import {
  guide,
  guideExampleSection,
  guideExamplesHeading,
  guideSchemaSection,
} from "@titan/messages";
import { workflowJsonSchema } from "@titan/workflow";
import { exists } from "@titan/workspace";

async function examplesRoot(): Promise<string> {
  const candidates = GuideExamples.RootPaths.map((path) => resolve(import.meta.dir, path));
  const found = await all(
    candidates.map((candidate) => async () => exists(resolve(candidate, GuideExamples.Folder))),
  );
  return candidates[found.indexOf(true)] ?? candidates[0] ?? import.meta.dir;
}

export function schemaText(): string {
  return JSON.stringify(workflowJsonSchema(), null, 2);
}

export async function renderGuide(): Promise<string> {
  const root = await examplesRoot();
  const examples = await all(
    GuideExamples.Names.map(
      (name) => async () =>
        guideExampleSection(
          `${name}${GuideExamples.Extension}`,
          await Bun.file(
            resolve(root, GuideExamples.Folder, `${name}${GuideExamples.Extension}`),
          ).text(),
        ),
    ),
  );
  return [guide, guideSchemaSection(schemaText()), guideExamplesHeading, ...examples].join(
    GuideExamples.Joiner,
  );
}
