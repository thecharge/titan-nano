import { resolve } from "node:path";
import {
  KnowledgeCommand,
  KnowledgeFile,
  KnowledgeKind,
  type KnowledgeSearchMode,
} from "@titan/constants";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { KnowledgeSearchSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { withClientAddress } from "../support/client.ts";

export async function knowledgeClientReply(
  command: KnowledgeCommand,
  input: unknown,
  reply: unknown,
) {
  return withClientAddress(Response.json(reply), async (home) => {
    const client = createKnowledgeClient(home);
    if (command === KnowledgeCommand.Get) return Boolean(await client.get(String(input)));
    if (command === KnowledgeCommand.Add) return Boolean(await client.add(input));
    if (command === KnowledgeCommand.Update) return Boolean(await client.update(input));
    if (command === KnowledgeCommand.Delete) return Boolean(await client.delete(input));
    if (command === KnowledgeCommand.Search) return Boolean(await client.search(input));
    return Boolean(await client.reindex());
  });
}

export async function knowledgeCliValidation(args: string[]) {
  const output: unknown[] = [];
  const cli = createCli({
    ...defaultServices,
    output: (value) => {
      output.push(value);
    },
  });
  return cli(args);
}

export async function knowledgeSearchReply(
  mode: KnowledgeSearchMode,
  actual: KnowledgeSearchMode,
  warning: string | null,
  score: number | null,
) {
  let selected = "";
  const id = "11111111-1111-4111-8111-111111111111";
  const query = KnowledgeSearchSchema.parse({ question: "time zones", mode });
  return withClientAddress(
    () =>
      Response.json({
        schema_version: 1,
        revision: "a".repeat(64),
        query,
        actual_mode: actual,
        warning,
        truncated: false,
        results: [
          {
            id,
            kind: KnowledgeKind.Fact,
            title: "Time zones",
            tags: [],
            version: 1,
            path: resolve(
              selected,
              KnowledgeFile.Directory,
              KnowledgeKind.Fact,
              id + KnowledgeFile.Markdown,
            ),
            matched: "Time zones",
            score,
          },
        ],
      }),
    async (home) => {
      selected = home;
      return Boolean(await createKnowledgeClient(home).search(query));
    },
  );
}
