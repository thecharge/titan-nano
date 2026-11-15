import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import {
  CliCommand,
  CliRuntime,
  ErrorCode,
  ExitCode,
  IoLimit,
  KnowledgeCommand,
  KnowledgeWriterFixture,
  ProbeOption,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { knowledgeBytes } from "@titan/knowledge";
import { readBytes, readFileBytes } from "@titan/streams";
import {
  KnowledgeEntryResultSchema,
  KnowledgeWriterInputSchema,
  KnowledgeWriterResultSchema,
  ScopedKnowledgeEntryResultSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

const input = KnowledgeWriterInputSchema.parse(
  JSON.parse((await readFileBytes(process.argv[2], IoLimit.AddressBytes)).toString()),
);
let output;
const cli = createCli({
  ...defaultServices,
  output: (value) => {
    output = value;
  },
});
const flags = [
  ProbeOption.Home,
  input.home,
  ProbeOption.Project,
  input.project,
  CliRuntime.JsonFlag,
];
assert.equal(
  await cli([CliCommand.Knowledge, KnowledgeCommand.Get, input.id, ...flags]),
  ExitCode.Success,
);
let current = ScopedKnowledgeEntryResultSchema.parse(output).entry;
assert.equal(current.kind, input.kind);
await writeFile(input.ready, Buffer.from(KnowledgeWriterFixture.Gate));
assert.equal((await readBytes(Bun.stdin.stream(), 1)).toString(), KnowledgeWriterFixture.Gate);
const result = {
  pid: process.pid,
  attempts: KnowledgeWriterFixture.Updates,
  conflicts: 0,
  committed: [],
};
async function update(index) {
  const version = input.stale ? 1 : current.version;
  const body = `${process.pid}:${index}`;
  await writeFile(input.file, knowledgeBytes({ ...current, version, body }, IoLimit.DataBytes));
  try {
    assert.equal(
      await cli([
        CliCommand.Knowledge,
        KnowledgeCommand.Update,
        input.id,
        input.file,
        ProbeOption.EntryVersion,
        String(version),
        ...flags,
      ]),
      ExitCode.Success,
    );
    const entry = KnowledgeEntryResultSchema.parse(output).entry;
    assert.equal(entry.id, input.id);
    assert.equal(entry.version, version + 1);
    assert.equal(entry.body, body);
    result.committed.push({ version: entry.version, body });
  } catch (error) {
    assert.ok(error instanceof TitanError);
    assert.equal(error.code, ErrorCode.KnowledgeConflict);
    assert.equal(error.exitCode, ExitCode.Input);
    result.conflicts++;
  }
}
for (let index = 0; index < KnowledgeWriterFixture.Updates; index++) {
  await update(index);
  if (!input.stale) {
    assert.equal(
      await cli([CliCommand.Knowledge, KnowledgeCommand.Get, input.id, ...flags]),
      ExitCode.Success,
    );
    current = ScopedKnowledgeEntryResultSchema.parse(output).entry;
  }
}
console.log(JSON.stringify(KnowledgeWriterResultSchema.parse(result)));
