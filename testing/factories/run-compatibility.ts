import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardFile,
  CliCommand,
  CliRuntime,
  ErrorCode,
  ExitCode,
  FakeScriptLimit,
  IoLimit,
  Newline,
  Packaging,
  ProbeOption,
  RunCompatibilityFixture,
  RunEventKind,
  RunFormat,
  TitanRelease,
  Verdict,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { BoardMessage, unsupportedRunFormat, unsupportedRunRuntime } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliOutputSchema, RunEventSchema, RunSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { captureCli, stopCommand } from "../support/command.ts";
import { checkedWorkflow } from "./hardening.ts";
import { legacyEngineRun } from "./legacy-run.ts";
import { serverReady, spawnServer } from "./server-process.ts";

function compatibilityAnswers() {
  const step = checkedWorkflow().steps[0];
  assert(step);
  const worker = { ...step.do, answer: { checked: true } };
  const check = step.falsify[0];
  assert(check);
  const checker = { ...check, answer: { verdict: Verdict.Survived, evidence: Verdict.Survived } };
  return { version: FakeScriptLimit.Version, answers: [worker, checker] };
}

function compatibilityEvent(
  line: string,
  version: number,
  changed: boolean,
  runtimeVersion?: string | null,
) {
  const event = RunEventSchema.parse(JSON.parse(line));
  if (!changed) return line;
  const state = { ...event.state, schema_version: version };
  if (version < RunFormat.PersonaBindings) {
    delete state.persona_references;
    delete state.source_plan;
  }
  if (version < RunFormat.PinnedBuild) delete state.runtime_build;
  if (version < RunFormat.PinnedRuntime) delete state.runtime_version;
  if (version === RunFormat.PinnedRuntime) state.runtime_version = runtimeVersion ?? TitanRelease;
  if (runtimeVersion === null) delete state.runtime_version;
  if (version === RunFormat.CallerSessions)
    state.harness_session_id = RunCompatibilityFixture.Session;
  return JSON.stringify({ ...event, state });
}

export async function runCompatibility(
  version: number,
  expectedCode: ErrorCode | null,
  cli = resolve(Packaging.CliSource),
  runtimeVersion?: string | null,
  caller = false,
) {
  return withTemporaryDirectory((root) =>
    compatibilityAtRoot(root, version, expectedCode, cli, runtimeVersion, caller),
  );
}

async function compatibilityAtRoot(
  root: string,
  version: number,
  expectedCode: ErrorCode | null,
  cli: string,
  runtimeVersion: string | null | undefined,
  caller: boolean,
) {
  await using resources = new AsyncDisposableStack();
  const home = resolve(root, RunCompatibilityFixture.Home);
  const project = resolve(root, RunCompatibilityFixture.Project);
  await mkdir(project);
  const source = resolve(project, RunCompatibilityFixture.Source);
  await writeFile(source, Buffer.from(RunCompatibilityFixture.Content));
  const workflow = resolve(root, RunCompatibilityFixture.Workflow);
  const answers = resolve(root, RunCompatibilityFixture.Answers);
  await writeFile(workflow, Buffer.from(Bun.YAML.stringify(checkedWorkflow())));
  await writeFile(answers, Buffer.from(Bun.YAML.stringify(compatibilityAnswers())));
  const first = spawnServer(home, cli);
  resources.defer(() => stopCommand(first));
  assert(await waitUntil(() => serverReady(home, first.pid)));
  const created = await captureCli(cli, [
    CliCommand.Run,
    workflow,
    ProbeOption.Home,
    home,
    ProbeOption.Project,
    project,
    ProbeOption.Harness,
    Backend.Fake,
    ProbeOption.FakeScript,
    answers,
    ...(caller ? [ProbeOption.HarnessSessionId, RunCompatibilityFixture.Session] : []),
    CliRuntime.JsonFlag,
  ]);
  assert.equal(created.code, ExitCode.Success, created.output.toString());
  const run = RunSchema.parse(CliOutputSchema.parse(JSON.parse(created.output.toString())).data);
  await stopCommand(first);
  const journal = resolve(run.root, BoardFile.Journal);
  const projection = resolve(run.root, BoardFile.State);
  const lines = (await readFileBytes(journal, IoLimit.ResponseBytes))
    .toString()
    .trimEnd()
    .split(Newline)
    .filter((line) => {
      const event = RunEventSchema.parse(JSON.parse(line));
      return event.type !== RunEventKind.PhaseReceived && event.type !== RunEventKind.PhaseCaptured;
    })
    .map((line, index) => {
      const event = RunEventSchema.parse(JSON.parse(line));
      event.id = index + 1;
      event.state.version = event.id;
      return JSON.stringify(event);
    });
  const changed = lines.map((line, index) =>
    compatibilityEvent(
      line,
      version,
      expectedCode === null || runtimeVersion === null || index === lines.length - 1,
      runtimeVersion,
    ),
  );
  const tail = expectedCode ? RunCompatibilityFixture.Tail : "";
  const before = Buffer.from(changed.join(Newline) + Newline + tail);
  await writeFile(journal, before);
  const savedProjection = await readFileBytes(projection, IoLimit.ResponseBytes);
  const second = spawnServer(home, cli);
  resources.defer(() => stopCommand(second));
  assert(await waitUntil(() => serverReady(home, second.pid)));
  const operations = expectedCode
    ? [CliCommand.Status, CliCommand.Resume, CliCommand.Events]
    : [CliCommand.Status, CliCommand.Events];
  for (const operation of operations)
    await compatibilityCommand(
      cli,
      home,
      run.run_id,
      operation,
      version,
      expectedCode,
      runtimeVersion,
    );
  assert.deepEqual(await readFileBytes(journal, IoLimit.ResponseBytes), before);
  assert.deepEqual(await readFileBytes(projection, IoLimit.ResponseBytes), savedProjection);
  assert.equal(
    (await readFileBytes(source, IoLimit.DataBytes)).toString(),
    RunCompatibilityFixture.Content,
  );
  return true;
}

async function compatibilityCommand(
  cli: string,
  home: string,
  id: string,
  operation: CliCommand,
  version: number,
  expectedCode: ErrorCode | null,
  runtimeVersion?: string | null,
) {
  const result = await captureCli(cli, [
    operation,
    id,
    ProbeOption.Home,
    home,
    CliRuntime.JsonFlag,
  ]);
  assert.equal(result.error.length, 0);
  assert.equal(
    result.code,
    expectedCode ? ExitCode.Input : ExitCode.Success,
    result.output.toString(),
  );
  const output = CliOutputSchema.parse(JSON.parse(result.output.toString()));
  if (expectedCode) {
    assert.equal(output.error?.code, expectedCode);
    const message =
      expectedCode === ErrorCode.CorruptBoard
        ? BoardMessage.Record
        : runtimeVersion
          ? unsupportedRunRuntime(runtimeVersion)
          : unsupportedRunFormat(version);
    assert.equal(output.error.message, message);
    if (expectedCode !== ErrorCode.CorruptBoard) {
      assert(output.error.message.includes(RunCompatibilityFixture.RecoveryGuide));
      assert(output.error.message.includes(RunCompatibilityFixture.RecoveryInstruction));
    }
    assert.equal(output.data, null);
    return;
  }
  assert.equal(output.error, null);
  assert.equal(output.identifiers.run_id, id);
  if (operation === CliCommand.Status) {
    const run = RunSchema.parse(output.data);
    assert.equal(run.schema_version, version);
    assert.equal(
      run.runtime_version,
      version === RunFormat.PinnedRuntime ? TitanRelease : undefined,
    );
  } else assert(output.events.length > 0);
}

export async function storeCompatibility(
  version: number,
  expectedCode: ErrorCode | null,
  commit: boolean,
) {
  return withTemporaryDirectory((root) =>
    storeCompatibilityAtRoot(root, version, expectedCode, commit),
  );
}

async function storeCompatibilityAtRoot(
  root: string,
  version: number,
  expectedCode: ErrorCode | null,
  commit: boolean,
) {
  const home = resolve(root, RunCompatibilityFixture.Home);
  const config = await resolveConfig({ home, project: root });
  const { run } = await legacyEngineRun(createFakeBackend, {
    project: root,
    config,
    plan: validateWorkflow(checkedWorkflow()),
    backend: Backend.Fake,
    client_id: RunCompatibilityFixture.Session,
    submission_id: RunCompatibilityFixture.Session,
    ...(version === RunFormat.CallerSessions
      ? { harness_session_id: RunCompatibilityFixture.Session }
      : {}),
  });
  const store = new RunStore(run.root);
  const original = await store.read();
  const journal = resolve(run.root, BoardFile.Journal);
  const projection = resolve(run.root, BoardFile.State);
  let bytes = await readFileBytes(journal, IoLimit.ResponseBytes);
  const state = { ...run, schema_version: version, version: run.version + 1 };
  const record = {
    id: state.version,
    time: Date.now(),
    type: RunEventKind.Restart,
    data: null,
    state,
  };
  if (!commit && expectedCode) {
    bytes = Buffer.concat([
      bytes,
      Buffer.from(JSON.stringify(record) + Newline + RunCompatibilityFixture.Tail),
    ]);
    await writeFile(journal, bytes);
  }
  const savedProjection = await readFileBytes(projection, IoLimit.ResponseBytes);
  Reflect.set(run, "schema_version", version);
  const failure = await thrownBy(() =>
    commit ? store.commit(run, RunEventKind.Restart) : new RunStore(run.root).read(),
  );
  if (expectedCode) {
    assert(failure instanceof TitanError);
    assert.equal(failure.code, expectedCode);
    assert.equal(failure.message, unsupportedRunFormat(version));
    assert(failure.message.includes(RunCompatibilityFixture.RecoveryGuide));
    assert(failure.message.includes(RunCompatibilityFixture.RecoveryInstruction));
    assert.deepEqual(await readFileBytes(journal, IoLimit.ResponseBytes), bytes);
    assert.deepEqual(await readFileBytes(projection, IoLimit.ResponseBytes), savedProjection);
    assert.deepEqual(await store.snapshot(), original);
    if (commit) await store.commit(original, RunEventKind.Restart);
  } else {
    assert.equal(failure, undefined);
    assert.equal((await new RunStore(run.root).read()).schema_version, version);
  }
  return true;
}
