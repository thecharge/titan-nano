import { strict as assert } from "node:assert";
import { opendir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { agentHostEnvironment } from "@titan/config";
import {
  AgentHost,
  CliCommand,
  ConfigDefault,
  ErrorCode,
  ExitCode,
  IoLimit,
  KnowledgeCommand,
  KnowledgeFile,
  type KnowledgeKind,
  KnowledgeSearchMode,
  KnowledgeWriterFixture,
  ProbeOption,
  ProcessIo,
  ProcessSignal,
  StoreEviction,
} from "@titan/constants";
import { all } from "@titan/core";
import { knowledgeBytes, parseKnowledgeEntry } from "@titan/knowledge";
import { startServer } from "@titan/server";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { BoundedStore } from "@titan/store";
import { readBytes, readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CliOutputErrorSchema,
  type KnowledgeEntry,
  KnowledgeEntryResultSchema,
  type KnowledgeWriterResult,
  KnowledgeWriterResultSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { createFakeBackend } from "../support/backend.ts";
import { runCliCommand } from "../support/command.ts";
import { knowledgeDraft } from "./knowledge.ts";

async function spawnWriter(
  root: string,
  home: string,
  entry: KnowledgeEntry,
  stale: boolean,
  index: number,
  resources: AsyncDisposableStack,
) {
  const prefix = join(root, String(index));
  const input = {
    home,
    project: prefix + KnowledgeWriterFixture.ProjectSuffix,
    id: entry.id,
    kind: entry.kind,
    stale,
    ready: prefix + KnowledgeWriterFixture.ReadySuffix,
    file: prefix + KnowledgeWriterFixture.ImportSuffix,
  };
  const path = prefix + KnowledgeWriterFixture.InputSuffix;
  await writeFile(path, Buffer.from(JSON.stringify(input)));
  const child = Bun.spawn(
    [process.execPath, AgentHost.SmallHeap, resolve(KnowledgeWriterFixture.Source), path],
    {
      env: agentHostEnvironment(ConfigDefault.HostGcMarkers),
      stdin: ProcessIo.Pipe,
      stdout: ProcessIo.Pipe,
      stderr: ProcessIo.Pipe,
      timeout: KnowledgeWriterFixture.TimeoutMilliseconds,
    },
  );
  resources.defer(async () => {
    if (child.exitCode === null) child.kill(ProcessSignal.Kill);
    await child.exited;
  });
  return { child, ready: input.ready };
}

async function receipt(writer: Awaited<ReturnType<typeof spawnWriter>>) {
  const { child } = writer;
  const [output, error, code] = await all([
    () => readBytes(child.stdout, IoLimit.ResponseBytes),
    () => readBytes(child.stderr, IoLimit.ResponseBytes),
    () => child.exited,
  ]);
  assert.equal(code, ExitCode.Success, error.toString());
  return KnowledgeWriterResultSchema.parse(JSON.parse(output.toString()));
}

async function writerReady(writer: Awaited<ReturnType<typeof spawnWriter>>): Promise<boolean> {
  if (writer.child.exitCode !== null) await receipt(writer);
  return exists(writer.ready);
}

async function checkHistory(
  home: string,
  initial: KnowledgeEntry,
  reports: KnowledgeWriterResult[],
) {
  const committed = reports.flatMap((report) => report.committed);
  const versions = new BoundedStore<number, string>({
    maxEntries: KnowledgeWriterFixture.Processes * KnowledgeWriterFixture.Updates,
    eviction: StoreEviction.Reject,
  });
  for (const entry of committed) {
    assert.equal(versions.has(entry.version), false);
    versions.set(entry.version, entry.body);
  }
  const directory = join(
    home,
    KnowledgeFile.Directory,
    KnowledgeFile.History,
    initial.kind,
    initial.id,
  );
  let count = 0;
  for await (const file of await opendir(directory)) {
    assert.ok(file.isFile());
    const entry = parseKnowledgeEntry(
      await readFileBytes(join(directory, file.name), IoLimit.DataBytes),
      IoLimit.DataBytes,
    );
    assert.equal(entry.id, initial.id);
    assert.equal(entry.kind, initial.kind);
    assert.equal(entry.body, entry.version === 1 ? initial.body : versions.get(entry.version));
    assert.equal(file.name, String(entry.version) + KnowledgeFile.Markdown);
    count++;
  }
  assert.equal(count, committed.length);
  for (let version = 2; version <= committed.length + 1; version++)
    assert.ok(versions.has(version));
  return versions;
}

export async function knowledgeWriters(kind: KnowledgeKind, stale: boolean) {
  async function observe(root: string) {
    await using resources = new AsyncDisposableStack();
    const home = join(root, KnowledgeWriterFixture.Home);
    let server = await startServer(home, createFakeBackend);
    resources.defer(() => server.stop());
    const client = createKnowledgeClient(home);
    const initial = KnowledgeEntryResultSchema.parse(await client.add(knowledgeDraft(kind))).entry;
    const writers = await all(
      Array.from(
        { length: KnowledgeWriterFixture.Processes },
        (_, index) => () => spawnWriter(root, home, initial, stale, index, resources),
      ),
      KnowledgeWriterFixture.Processes,
    );
    assert.ok(
      await waitUntil(
        async () =>
          (
            await all(
              writers.map((writer) => () => writerReady(writer)),
              KnowledgeWriterFixture.Processes,
            )
          ).every(Boolean),
        KnowledgeWriterFixture.ObserveAttempts,
      ),
    );
    for (const writer of writers) {
      writer.child.stdin.write(KnowledgeWriterFixture.Gate);
      writer.child.stdin.end();
    }
    const reports = await all(
      writers.map((writer) => () => receipt(writer)),
      KnowledgeWriterFixture.Processes,
    );
    assert.equal(
      new Set(reports.map((report) => report.pid)).size,
      KnowledgeWriterFixture.Processes,
    );
    const committed = reports.reduce((count, report) => count + report.committed.length, 0);
    const conflicts = reports.reduce((count, report) => count + report.conflicts, 0);
    assert.equal(
      committed + conflicts,
      KnowledgeWriterFixture.Processes * KnowledgeWriterFixture.Updates,
    );
    assert.ok(committed > 0);
    assert.ok(conflicts > 0);
    if (stale) assert.equal(committed, 1);
    const versions = await checkHistory(home, initial, reports);
    const final = KnowledgeEntryResultSchema.parse(await client.get(initial.id));
    assert.equal(final.entry.version, committed + 1);
    assert.equal(final.entry.body, versions.get(final.entry.version));
    const staleFile = join(root, KnowledgeWriterFixture.StaleImport);
    await writeFile(staleFile, knowledgeBytes(initial, IoLimit.DataBytes));
    const refused = CliOutputErrorSchema.parse(
      await runCliCommand(
        resolve("apps/cli/src/main.ts"),
        home,
        [
          CliCommand.Knowledge,
          KnowledgeCommand.Update,
          initial.id,
          staleFile,
          ProbeOption.EntryVersion,
          "1",
          ProbeOption.Project,
          join(root, KnowledgeWriterFixture.StaleProject),
        ],
        ExitCode.Input,
      ),
    );
    assert.equal(refused.code, ErrorCode.KnowledgeConflict);
    assert.deepEqual(await client.get(initial.id), final);
    const page = await client.search({ kind, mode: KnowledgeSearchMode.Words });
    assert.equal(page.revision, final.revision);
    assert.equal(page.results[0]?.version, final.entry.version);
    await server.stop();
    server = await startServer(home, createFakeBackend);
    assert.deepEqual(await client.get(initial.id), final);
    return true;
  }
  return withTemporaryDirectory(observe);
}
