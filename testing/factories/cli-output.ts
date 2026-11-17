import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  CliCommand,
  CliRecoveryAction,
  CliRuntime,
  EnvVar,
  ErrorCode,
  ExitCode,
  HookFile,
  Packaging,
  ProbeOption,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliOutputSchema, CompactRunSchema, RunSchema } from "@titan/types";
import { captureCli } from "../support/command.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function cliEnvelopeProcess(
  parallel: boolean,
  blocked: boolean,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
): Promise<boolean> {
  return withTemporaryDirectory((root) => observeEnvelopeProcess(root, parallel, blocked, cli));
}

async function observeEnvelopeProcess(
  root: string,
  parallel: boolean,
  blocked: boolean,
  cli: string,
): Promise<boolean> {
  await using resources = new AsyncDisposableStack();
  const project = resolve(root, "project");
  const home = resolve(root, "home");
  await mkdir(project);
  const base = checkedWorkflow();
  const step = base.steps[0];
  assert(step);
  const steps = [step, { ...step, id: "two" }];
  const workflow = { ...base, steps: parallel ? [{ parallel: steps }] : steps };
  const file = resolve(project, "workflow.yaml");
  await writeFile(file, Buffer.from(Bun.YAML.stringify(workflow)));
  const server = await startServer(
    home,
    () =>
      new FakeBackend(async (spec) => {
        if (spec.persona_id !== step.do.persona)
          return { json: { verdict: Verdict.Survived, evidence: "Independent check" } };
        if (blocked) throw new OperationalError(ErrorCode.BackendExecutable, "Credentials absent");
        return { json: { note: "Checked delivery" } };
      }),
  );
  resources.defer(() => server.stop());
  const environment = { ...process.env, [EnvVar.TitanHome]: resolve(root, "registry") };
  const result = await captureCli(
    cli,
    [
      CliCommand.Run,
      file,
      ProbeOption.Home,
      home,
      ProbeOption.Project,
      project,
      ProbeOption.Backend,
      Backend.Fake,
      CliRuntime.JsonFlag,
    ],
    project,
    environment,
  );
  assert.equal(result.code, blocked ? ExitCode.Blocked : ExitCode.Success, result.error.toString());
  assert.equal(result.error.length, 0);
  assert.equal(result.output.toString().trim().split("\n").length, 1);
  const envelope = CliOutputSchema.parse(JSON.parse(result.output.toString()));
  const run = RunSchema.parse(envelope.data);
  assert.equal(envelope.operation, CliCommand.Run);
  assert.equal(envelope.state, blocked ? RunStatus.Blocked : RunStatus.Passed);
  assert.equal(envelope.identifiers.run_id, run.run_id);
  assert.equal(envelope.identifiers.client_id, run.client_id);
  assert.equal(envelope.identifiers.submission_id, run.submission_id);
  assert.equal(envelope.identifiers.workflow_id, run.workflow_id);
  assert(envelope.events.length > 0);
  assert.equal(envelope.after, 0);
  assert.equal(envelope.next_cursor, envelope.events.at(-1)?.id);
  assert.equal(envelope.truncated, envelope.has_more);
  for (const node of Object.values(run.nodes)) assert.equal(node.refutations, 0);
  if (blocked) {
    assert.equal(envelope.error?.recovery?.action, CliRecoveryAction.Resume);
    assert.equal(envelope.error.recovery.run_id, run.run_id);
    assert.equal(envelope.error.retryable, false);
  } else assert.equal(envelope.error, null);
  const status = async (extra: string[], expected: ExitCode = ExitCode.Success) => {
    const result = await captureCli(
      cli,
      [CliCommand.Status, run.run_id, ProbeOption.Home, home, CliRuntime.JsonFlag, ...extra],
      project,
      environment,
    );
    assert.equal(result.code, expected, result.error.toString());
    return CliOutputSchema.parse(JSON.parse(result.output.toString()));
  };
  const full = await status([]);
  assert.equal(RunSchema.parse(full.data).run_id, run.run_id);
  assert.ok(full.events.length);
  const compact = await status(["--compact"]);
  const projected = CompactRunSchema.parse(compact.data);
  assert.equal(projected.run_id, run.run_id);
  assert.deepEqual(Object.keys(projected.nodes), Object.keys(run.nodes));
  assert.deepEqual(compact.events, []);
  assert.equal(projected.usage.run_id, run.run_id);
  const watched = await status(
    ["--compact", "--watch"],
    blocked ? ExitCode.Blocked : ExitCode.Success,
  );
  assert.deepEqual(watched.data, compact.data);
  assert.deepEqual(watched.events, []);
  const missing = resolve(root, "unavailable");
  for (const selectors of [
    ["--scope", "project"],
    ["--project", project],
  ]) {
    const conflict = await captureCli(
      cli,
      [CliCommand.Runs, ...selectors, "--project-path", missing, CliRuntime.JsonFlag],
      project,
      environment,
    );
    assert.equal(conflict.code, ExitCode.Input, conflict.error.toString());
  }
  const discovery = await captureCli(
    cli,
    [
      CliCommand.Runs,
      "--scope",
      "known-home",
      "--state",
      run.state,
      ProbeOption.Home,
      missing,
      CliRuntime.JsonFlag,
    ],
    project,
    environment,
  );
  assert.equal(discovery.code, ExitCode.Success, discovery.error.toString());
  const homes = CliOutputSchema.parse(JSON.parse(discovery.output.toString())).data;
  assert.deepEqual(homes, {
    homes: [
      {
        home: missing,
        error: await createRunClient(missing)
          .list()
          .catch((error: Error) => error.message),
      },
      { home, page: await createRunClient(home).list({ state: run.state }) },
    ].sort((left, right) => left.home.localeCompare(right.home)),
    has_more: false,
    next_home: null,
  });
  const first = await captureCli(
    cli,
    [
      CliCommand.Events,
      run.run_id,
      ProbeOption.Home,
      home,
      ProbeOption.Limit,
      "1",
      CliRuntime.JsonFlag,
    ],
    project,
    environment,
  );
  assert.equal(first.code, ExitCode.Success, first.error.toString());
  const page = CliOutputSchema.parse(JSON.parse(first.output.toString()));
  assert.equal(page.operation, CliCommand.Events);
  assert.equal(page.identifiers.run_id, run.run_id);
  assert.equal(page.events.length, 1);
  assert.equal(page.next_cursor, 1);
  assert.equal(page.has_more, true);
  assert.equal(page.truncated, true);
  const next = await captureCli(
    cli,
    [
      CliCommand.Events,
      run.run_id,
      ProbeOption.Home,
      home,
      ProbeOption.After,
      String(page.next_cursor),
      CliRuntime.JsonFlag,
    ],
    project,
    environment,
  );
  assert.equal(next.code, ExitCode.Success, next.error.toString());
  const remaining = CliOutputSchema.parse(JSON.parse(next.output.toString()));
  assert.equal(remaining.after, page.next_cursor);
  assert.equal(remaining.has_more, false);
  const history = await createRunClient(home).events(run.run_id);
  assert.deepEqual([...page.events, ...remaining.events], history.events);
  return true;
}

export async function cliEnvelopeQuery(
  args: string[],
  expected: ExitCode,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
): Promise<boolean> {
  const result = await captureCli(cli, [...args, CliRuntime.JsonFlag]);
  assert.equal(result.code, expected, result.error.toString());
  assert.equal(result.error.length, 0);
  assert.equal(result.output.toString().trim().split("\n").length, 1);
  const envelope = CliOutputSchema.parse(JSON.parse(result.output.toString()));
  assert.equal(envelope.state, null);
  assert.equal(envelope.identifiers.run_id, null);
  assert.equal(envelope.events.length, 0);
  assert.equal(envelope.next_cursor, null);
  if (expected === ExitCode.Success) assert.equal(envelope.error, null);
  else {
    assert(envelope.error);
    assert.equal(envelope.error.retryable, false);
    assert.equal(envelope.error.recovery, null);
    assert.deepEqual(envelope.error.paths, []);
    assert.equal(envelope.data, null);
  }
  return true;
}
