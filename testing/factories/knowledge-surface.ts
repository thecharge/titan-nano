import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ErrorCode,
  ExitCode,
  HttpMethod,
  IoLimit,
  KnowledgeCommand,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeRoute,
  KnowledgeScope,
  KnowledgeScopeFixture,
  KnowledgeSearchMode,
  KnowledgeToolForCommand,
  KnowledgeTransport,
} from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { knowledgeBytes } from "@titan/knowledge";
import { call, startServer } from "@titan/server";
import { startMcp } from "@titan/server/mcp";
import { readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type KnowledgeCall,
  KnowledgeEntryResultSchema,
  KnowledgeReindexResultSchema,
  KnowledgeSearchPageSchema,
  type KnowledgeTestInvoke,
  McpTextContentSchema,
  ScopedKnowledgeEntryResultSchema,
  ScopedKnowledgeSearchPageSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";
import { knowledgeDraft } from "./knowledge.ts";

const PageOrScoped = KnowledgeSearchPageSchema.or(ScopedKnowledgeSearchPageSchema);
const EntryOrScoped = KnowledgeEntryResultSchema.or(ScopedKnowledgeEntryResultSchema);

async function knowledgeCliArguments(input: KnowledgeCall, directory: string) {
  const args: string[] = ["kb", input.operation];
  if (input.operation === KnowledgeCommand.Add || input.operation === KnowledgeCommand.Update) {
    const entry =
      input.operation === KnowledgeCommand.Add
        ? { ...input.input, id: input.input.id ?? newId(), version: 1 }
        : { ...input.input.entry, id: input.input.id, version: input.input.version };
    const path = join(directory, "import.md");
    await writeFile(path, knowledgeBytes(entry, IoLimit.DataBytes));
    if (input.operation === KnowledgeCommand.Update) args.push(input.input.id);
    args.push(path);
    if (input.operation === KnowledgeCommand.Add) args.push("--scope", KnowledgeScope.Home);
  } else if (
    input.operation === KnowledgeCommand.Get ||
    input.operation === KnowledgeCommand.Delete
  )
    args.push(input.input.id);
  if (input.operation === KnowledgeCommand.Update || input.operation === KnowledgeCommand.Delete)
    args.push("--entry-version", String(input.input.version));
  if (input.operation === KnowledgeCommand.Search) {
    if (input.input.question) args.push(input.input.question);
    args.push("--mode", input.input.mode, "--limit", String(input.input.limit));
    if (input.input.kind) args.push("--kind", input.input.kind);
  }
  return args;
}

async function connectSurface(
  home: string,
  directory: string,
  transport: KnowledgeTransport,
  resources: AsyncDisposableStack,
): Promise<KnowledgeTestInvoke> {
  if (transport === KnowledgeTransport.Http)
    return (input) => call(home, KnowledgeRoute, HttpMethod.Post, input);
  if (transport === KnowledgeTransport.Mcp) {
    const [left, right] = InMemoryTransport.createLinkedPair();
    const mcp = await startMcp(home, left);
    resources.defer(() => mcp.close());
    const client = new Client({ name: "knowledge-surface", version: "1" });
    resources.defer(() => client.close());
    await client.connect(right);
    return async (input) => {
      const response = await client.callTool({
        name: KnowledgeToolForCommand[input.operation],
        arguments: input.input,
      });
      const value = JSON.parse(McpTextContentSchema.parse(response.content)[0]?.text ?? "");
      if (response.isError) throw new TitanError(value.code, value.error);
      return value;
    };
  }
  return async (input) => {
    let result: unknown;
    const cli = createCli({
      ...defaultServices,
      output: (value) => {
        result = value;
      },
    });
    assert.equal(
      await cli([
        ...(await knowledgeCliArguments(input, directory)),
        "--home",
        home,
        ...(input.operation === KnowledgeCommand.Reindex
          ? []
          : ["--project", join(directory, KnowledgeScopeFixture.Project)]),
        "--json",
      ]),
      ExitCode.Success,
    );
    return result;
  };
}

export async function knowledgeSurface(
  transport: KnowledgeTransport,
  kind: KnowledgeKind,
  remove: boolean,
) {
  async function observe(directory: string) {
    const home = join(directory, "home");
    await using resources = new AsyncDisposableStack();
    let server = await startServer(home, createFakeBackend);
    resources.defer(() => server.stop());
    const invoke = await connectSurface(home, directory, transport, resources);
    const initial = EntryOrScoped.parse(
      await invoke({ operation: KnowledgeCommand.Add, input: knowledgeDraft(kind) }),
    );
    const id = initial.entry.id;
    const extension = kind === KnowledgeKind.Persona ? KnowledgeFile.Yaml : KnowledgeFile.Markdown;
    const bytes = await readFileBytes(
      join(home, KnowledgeFile.Directory, kind, id + extension),
      IoLimit.DataBytes,
    );
    assert.deepEqual(
      EntryOrScoped.parse(await invoke({ operation: KnowledgeCommand.Get, input: { id } })),
      initial,
    );
    const update = {
      id,
      version: 1,
      entry: { ...knowledgeDraft(kind), body: "Check time zones first after update" },
    };
    const changed = EntryOrScoped.parse(
      await invoke({
        operation: KnowledgeCommand.Update,
        input: update,
      }),
    );
    assert.equal(changed.entry.version, 2);
    const stale = await thrownBy(() =>
      invoke({ operation: KnowledgeCommand.Delete, input: { id, version: 1 } }),
    );
    assert.equal(Reflect.get(Object(stale), "code"), ErrorCode.KnowledgeConflict);
    const retained = await readFileBytes(
      join(home, KnowledgeFile.Directory, KnowledgeFile.History, kind, id, `1${extension}`),
      IoLimit.DataBytes,
    );
    assert.ok(retained.equals(bytes));
    const page = PageOrScoped.parse(
      await invoke({
        operation: KnowledgeCommand.Search,
        input: { question: "time zones", mode: KnowledgeSearchMode.Words, limit: 50 },
      }),
    );
    assert.equal(page.results[0]?.id, id);
    assert.ok(page.results[0]?.matched.includes("[time] [zones]"));
    if (transport !== KnowledgeTransport.Cli) assert.equal(page.revision, changed.revision);
    const rebuilt = KnowledgeReindexResultSchema.parse(
      await invoke({ operation: KnowledgeCommand.Reindex, input: {} }),
    );
    assert.equal(rebuilt.entries, 1);
    if (transport !== KnowledgeTransport.Cli) assert.equal(rebuilt.revision, page.revision);
    if (remove) await invoke({ operation: KnowledgeCommand.Delete, input: { id, version: 2 } });
    await server.stop();
    server = await startServer(home, createFakeBackend);
    const final = PageOrScoped.parse(
      await invoke({
        operation: KnowledgeCommand.Search,
        input: { question: "", kind, mode: KnowledgeSearchMode.Both, limit: 50 },
      }),
    );
    assert.equal(final.results.length, remove ? 0 : 1);
    assert.equal(final.actual_mode, KnowledgeSearchMode.Words);
    assert.ok(final.warning);
    if (!remove) assert.equal(final.results[0]?.version, 2);
    const index = (
      await readFileBytes(
        join(home, KnowledgeFile.Directory, KnowledgeFile.Index),
        IoLimit.DataBytes,
      )
    ).toString();
    assert.equal(index.includes(id), !remove);
    return true;
  }
  return withTemporaryDirectory(observe);
}
