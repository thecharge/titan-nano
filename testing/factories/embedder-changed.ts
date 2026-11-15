import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ConfigFile,
  EmbedderFixture,
  KnowledgeScopeFixture,
  KnowledgeSearchMode,
} from "@titan/constants";
import { createFakeEmbedder } from "@titan/embedder-fake";
import { startServer } from "@titan/server";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";

export async function embedderChanged(
  first: string | null,
  second: string | null,
  reindexed: boolean,
  injected: boolean,
) {
  return withTemporaryDirectory(async (directory) => {
    const home = join(directory, "home");
    await mkdir(home);
    const options = injected ? { embedders: [createFakeEmbedder()] } : {};
    const cli = createCli({ ...defaultServices, output: () => undefined });
    async function start(embedder: string | null) {
      const knowledge = embedder === null ? {} : { embedder };
      await writeFile(join(home, ConfigFile.User), JSON.stringify({ server: { knowledge } }));
      return startServer(home, createFakeBackend, options);
    }
    const initial = await start(first);
    await initial.stop();
    const server = await start(second);
    try {
      if (reindexed) await cli(["kb", "reindex", "--home", home, "--json"]);
      const error = await thrownBy(() =>
        cli([
          "kb",
          "search",
          EmbedderFixture.Question,
          "--mode",
          KnowledgeSearchMode.Meaning,
          "--home",
          home,
          "--project",
          join(directory, KnowledgeScopeFixture.Project),
          "--json",
        ]),
      );
      return {
        code: Reflect.get(Object(error), "code"),
        exit: Reflect.get(Object(error), "exitCode"),
        advice: String(Reflect.get(Object(error), "message")).includes(EmbedderFixture.Advice),
      };
    } finally {
      await server.stop();
    }
  });
}
