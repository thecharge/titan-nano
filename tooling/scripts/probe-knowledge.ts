import { strict as assert } from "node:assert";
import { cp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CliCommand,
  ErrorCode,
  ExitCode,
  KnowledgeCommand,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeMeaningFixture,
  KnowledgeProbe,
  KnowledgeScope,
  KnowledgeSearchMode,
  KnowledgeTool,
  LocalModel,
  ProbeOption,
  TextSymbol,
} from "@titan/constants";
import {
  CliOutputErrorSchema,
  KnowledgeEntryResultSchema,
  KnowledgeReindexResultSchema,
  LocalModelStatusSchema,
  McpTextContentSchema,
  type PackageProbeCommand,
  ScopedKnowledgeEntryResultSchema,
  ScopedKnowledgeMaintenanceResultSchema,
  ScopedKnowledgeSearchPageSchema,
  ScopedKnowledgeShowSchema,
  ScopedKnowledgeStatsSchema,
  ServerErrorSchema,
} from "@titan/types";
import { withStdioMcp } from "../../testing/support/mcp.ts";

function document(body: string): Buffer {
  return Buffer.from(
    KnowledgeFile.Header +
      Bun.YAML.stringify(
        { kind: KnowledgeKind.Fact, title: KnowledgeProbe.Title, tags: [] },
        null,
        2,
      ).trimEnd() +
      KnowledgeFile.HeaderEnd +
      body,
  );
}

export async function probeKnowledge(
  cli: string,
  home: string,
  directory: string,
  command: PackageProbeCommand,
): Promise<void> {
  const path = resolve(directory, KnowledgeProbe.File);
  await writeFile(path, document(KnowledgeProbe.Body));
  const added = ScopedKnowledgeEntryResultSchema.parse(
    await command([
      CliCommand.Knowledge,
      KnowledgeCommand.Add,
      path,
      ProbeOption.Scope,
      KnowledgeScope.Home,
    ]),
  );
  assert.equal(added.entry.body, KnowledgeProbe.Body);
  assert.equal(added.scope, KnowledgeScope.Home);
  const id = added.entry.id;
  assert.deepEqual(
    ScopedKnowledgeEntryResultSchema.parse(
      await command([CliCommand.Knowledge, KnowledgeCommand.Get, id]),
    ),
    added,
  );
  await writeFile(path, document(KnowledgeProbe.Updated));
  const changed = KnowledgeEntryResultSchema.parse(
    await command([
      CliCommand.Knowledge,
      KnowledgeCommand.Update,
      id,
      path,
      ProbeOption.EntryVersion,
      String(added.entry.version),
    ]),
  );
  assert.equal(changed.entry.version, 2);
  assert.equal(changed.entry.body, KnowledgeProbe.Updated);
  const shown = ScopedKnowledgeShowSchema.parse(
    await command([
      CliCommand.Knowledge,
      KnowledgeCommand.Show,
      id,
      ProbeOption.Scope,
      KnowledgeScope.Home,
      ProbeOption.Before,
      String(changed.entry.version),
      ProbeOption.Limit,
      String(added.entry.version),
    ]),
  );
  assert.deepEqual(shown.history.page.entries, [added.entry]);
  assert.equal(shown.history.page.next_before, null);
  const oldest = ScopedKnowledgeShowSchema.parse(
    await command([
      CliCommand.Knowledge,
      KnowledgeCommand.Show,
      id,
      ProbeOption.Scope,
      KnowledgeScope.Home,
      ProbeOption.Before,
      String(added.entry.version),
    ]),
  );
  assert.deepEqual(oldest.history.page.entries, []);
  assert.equal(oldest.history.page.next_before, null);
  const stats = ScopedKnowledgeStatsSchema.parse(
    await command([CliCommand.Knowledge, KnowledgeCommand.Stats]),
  );
  const dates = stats.scopes
    .find((scope) => scope.scope === KnowledgeScope.Home)
    ?.kinds.find((kind) => kind.kind === KnowledgeKind.Fact);
  assert.equal(dates?.oldest?.id, id);
  assert.equal(dates?.newest?.id, id);
  assert.ok(dates?.oldest?.updated);
  const future = CliOutputErrorSchema.parse(
    await command(
      [
        CliCommand.Knowledge,
        KnowledgeCommand.Show,
        id,
        ProbeOption.Scope,
        KnowledgeScope.Home,
        ProbeOption.Before,
        String(changed.entry.version + 1),
      ],
      ExitCode.Input,
    ),
  );
  assert.equal(future.code, ErrorCode.KnowledgeInvalid);
  const stale = CliOutputErrorSchema.parse(
    await command(
      [
        CliCommand.Knowledge,
        KnowledgeCommand.Delete,
        id,
        ProbeOption.EntryVersion,
        String(added.entry.version),
      ],
      ExitCode.Input,
    ),
  );
  assert.equal(stale.code, ErrorCode.KnowledgeConflict);
  const page = ScopedKnowledgeSearchPageSchema.parse(
    await command([
      CliCommand.Knowledge,
      KnowledgeCommand.Search,
      KnowledgeProbe.Question,
      ProbeOption.Mode,
      KnowledgeSearchMode.Words,
    ]),
  );
  assert.equal(page.results[0]?.id, id);
  assert.equal(page.results[0]?.scope, KnowledgeScope.Home);
  assert.equal(page.results[0]?.version, changed.entry.version);
  const rebuilt = KnowledgeReindexResultSchema.parse(
    await command([CliCommand.Knowledge, KnowledgeCommand.Reindex]),
  );
  assert.equal(rebuilt.entries, 1);
  await withStdioMcp(cli, [CliCommand.Mcp, ProbeOption.Home, home], async (client) => {
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    for (const tool of Object.values(KnowledgeTool)) assert.ok(names.includes(tool));
    const read = await client.callTool({ name: KnowledgeTool.Get, arguments: { id } });
    assert.notEqual(read.isError, true);
    assert.deepEqual(
      KnowledgeEntryResultSchema.parse(
        JSON.parse(McpTextContentSchema.parse(read.content)[0]?.text ?? TextSymbol.Empty),
      ),
      changed,
    );
    const removed = await client.callTool({
      name: KnowledgeTool.Delete,
      arguments: { id, version: changed.entry.version },
    });
    assert.notEqual(removed.isError, true);
    const absent = await client.callTool({ name: KnowledgeTool.Get, arguments: { id } });
    assert.equal(absent.isError, true);
    assert.equal(
      ServerErrorSchema.parse(
        JSON.parse(McpTextContentSchema.parse(absent.content)[0]?.text ?? TextSymbol.Empty),
      ).code,
      ErrorCode.KnowledgeMissing,
    );
  });
  const final = ScopedKnowledgeSearchPageSchema.parse(
    await command([
      CliCommand.Knowledge,
      KnowledgeCommand.Search,
      ProbeOption.Kind,
      KnowledgeKind.Fact,
      ProbeOption.Mode,
      KnowledgeSearchMode.Words,
    ]),
  );
  assert.deepEqual(final.results, []);
  await cp(
    resolve(process.cwd(), LocalModel.TestHome, LocalModel.Folder),
    resolve(home, LocalModel.Folder),
    { recursive: true },
  );
  const doctor = await command([CliCommand.Doctor]);
  assert.equal(
    LocalModelStatusSchema.parse(Reflect.get(Object(doctor), LocalModel.StatusField)).ready,
    true,
  );

  await writeFile(path, document(KnowledgeMeaningFixture.Body));
  const related = ScopedKnowledgeEntryResultSchema.parse(
    await command([CliCommand.Knowledge, KnowledgeCommand.Add, path]),
  );
  const meaning = ScopedKnowledgeSearchPageSchema.parse(
    await command([
      CliCommand.Knowledge,
      KnowledgeCommand.Search,
      KnowledgeMeaningFixture.Related,
      ProbeOption.Mode,
      KnowledgeSearchMode.Meaning,
    ]),
  );
  assert.equal(meaning.results[0]?.id, related.entry.id);
  const combined = ScopedKnowledgeSearchPageSchema.parse(
    await command([CliCommand.Knowledge, KnowledgeCommand.Search, KnowledgeMeaningFixture.Related]),
  );
  assert.equal(combined.results[0]?.id, related.entry.id);
  await writeFile(path, document(KnowledgeProbe.Updated));
  const source = [
    CliCommand.Knowledge,
    KnowledgeCommand.Add,
    path,
    ProbeOption.Scope,
    KnowledgeScope.Home,
  ];
  const one = ScopedKnowledgeEntryResultSchema.parse(await command(source));
  const two = ScopedKnowledgeEntryResultSchema.parse(await command(source));
  const scope = [ProbeOption.Scope, KnowledgeScope.Home];
  const report = ScopedKnowledgeMaintenanceResultSchema.parse(
    await command([CliCommand.Knowledge, KnowledgeCommand.Prune, ...scope]),
  );
  assert.equal(report.applied, false);
  assert.equal(report.candidates.filter((entry) => !entry.retained).length, 1);
  const removed = report.candidates.find((entry) => !entry.retained);
  assert(removed);
  const pruned = ScopedKnowledgeMaintenanceResultSchema.parse(
    await command([CliCommand.Knowledge, KnowledgeCommand.Prune, ProbeOption.Apply, ...scope]),
  );
  assert(pruned.applied);
  const restored = ScopedKnowledgeEntryResultSchema.parse(
    await command([CliCommand.Knowledge, KnowledgeCommand.Restore, removed.id, ...scope]),
  );
  assert.equal(restored.entry.version, 2);
  assert.equal(restored.entry.body, KnowledgeProbe.Updated);
  const consolidated = ScopedKnowledgeMaintenanceResultSchema.parse(
    await command([
      CliCommand.Knowledge,
      KnowledgeCommand.Consolidate,
      ProbeOption.Apply,
      ...scope,
    ]),
  );
  assert.equal(consolidated.publications.length, 1);
  assert.equal(consolidated.groups.length, 1);
  const group = consolidated.groups[0];
  assert(group);
  assert.deepEqual(
    group.sources.map((entry) => entry.id).sort(),
    [one.entry.id, two.entry.id].sort(),
  );
  const collision = CliOutputErrorSchema.parse(
    await command(
      [CliCommand.Knowledge, KnowledgeCommand.Restore, related.entry.id],
      ExitCode.Input,
    ),
  );
  assert.equal(collision.code, ErrorCode.KnowledgeConflict);
  console.log(JSON.stringify({ installed_knowledge_maintenance_cases: 5 }));
}
