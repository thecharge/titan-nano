import { strict as assert } from "node:assert";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ExitCode,
  IoLimit,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgeScope,
  KnowledgeState,
  KnowledgeTamper,
} from "@titan/constants";
import { parseKnowledgeFile } from "@titan/knowledge";
import { startServer } from "@titan/server";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ScopedKnowledgeEntryResultSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";

const oldBody = "Monthly rent";
const newBody = "Monthly rent rose";

function factText(title: string, body: string) {
  return `---\nkind: fact\ntitle: ${title}\n---\n${body}`;
}

export async function knowledgeCliScenario(title: string, tamper: KnowledgeTamper) {
  async function observe(directory: string) {
    const home = join(directory, "home");
    await using resources = new AsyncDisposableStack();
    const server = await startServer(home, createFakeBackend);
    resources.defer(() => server.stop());
    async function run(args: string[]) {
      let result: unknown;
      const cli = createCli({
        ...defaultServices,
        output: (value) => {
          result = value;
        },
      });
      assert.equal(
        await cli([...args, "--home", home, "--project", join(directory, "project"), "--json"]),
        ExitCode.Success,
      );
      return result;
    }
    const source = join(directory, "fact.md");
    await writeFile(source, factText(title, oldBody));
    const added = ScopedKnowledgeEntryResultSchema.parse(
      await run(["kb", "add", source, "--scope", KnowledgeScope.Home]),
    );
    const id = added.entry.id;
    const root = join(home, KnowledgeFile.Directory);
    const entryPath = join(root, KnowledgeKind.Fact, id + KnowledgeFile.Markdown);
    const stored = parseKnowledgeFile(
      await readFileBytes(entryPath, IoLimit.DataBytes),
      KnowledgeLimit.EntryBytes,
    );
    const indexPath = join(root, KnowledgeFile.Index);
    if (tamper === KnowledgeTamper.DropIndex) await rm(indexPath);
    const indexed = (await exists(indexPath))
      ? (await readFileBytes(indexPath, KnowledgeLimit.IndexBytes)).toString().split("\n")
      : [];
    const line = indexed.find((row) => row.includes(id)) ?? "";
    const next = join(directory, "new.md");
    await writeFile(next, factText(title, newBody));
    await run(["kb", "update", id, next, "--entry-version", "1"]);
    const current = ScopedKnowledgeEntryResultSchema.parse(await run(["kb", "get", id]));
    const historyPath = join(
      root,
      KnowledgeFile.History,
      KnowledgeKind.Fact,
      id,
      `1${KnowledgeFile.Markdown}`,
    );
    if (tamper === KnowledgeTamper.DropHistory) await rm(historyPath);
    const retained = (await exists(historyPath))
      ? parseKnowledgeFile(
          await readFileBytes(historyPath, IoLimit.DataBytes),
          KnowledgeLimit.EntryBytes,
        )
      : null;
    return {
      printed: id.length > 0 && added.entry.version === 1,
      file: stored.kind === KnowledgeKind.Fact && stored.title === title && stored.body === oldBody,
      row:
        line.includes(`| ${KnowledgeKind.Fact} |`) &&
        line.includes(`| ${title} |`) &&
        line.includes(`| ${KnowledgeState.Final} |`) &&
        line.includes(`](${KnowledgeKind.Fact}/${id}${KnowledgeFile.Markdown})`),
      version: current.entry.version === 2,
      body: current.entry.body === newBody,
      history: retained?.body === oldBody,
    };
  }
  return withTemporaryDirectory(observe);
}
