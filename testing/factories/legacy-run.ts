import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BoardFile, IoLimit, Newline, RunFormat } from "@titan/constants";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { type BackendFactory, type RunCreation, RunEventSchema } from "@titan/types";

export async function legacyEngineRun(factory: BackendFactory, options: RunCreation) {
  const created = await new Engine(factory).create(options);
  const path = resolve(created.root, BoardFile.Journal);
  const bytes = await readFileBytes(path, IoLimit.ResponseBytes);
  const lines = bytes.toString().trimEnd().split(Newline);
  assert.equal(lines.length, 1);
  const event = RunEventSchema.parse(JSON.parse(lines[0] ?? ""));
  event.state.schema_version =
    options.harness_session_id === undefined ? RunFormat.Legacy : RunFormat.CallerSessions;
  delete event.state.runtime_version;
  await writeFile(path, Buffer.from(JSON.stringify(event) + Newline));
  const engine = new Engine(factory);
  return { engine, run: await engine.load(created.root) };
}
