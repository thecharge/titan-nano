import { strict as assert } from "node:assert";
import { lstat, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import {
  Backend,
  BoardFile,
  CliCommand,
  ExampleFixture,
  ExampleMutation,
  ExecutionPhase,
  ExitCode,
  IoLimit,
  Packaging,
  ProbeOption,
  ProcessSignal,
  RunArtifactFile,
  RunEventKind,
  RunFile,
  RunStatus,
  SdkProcessFixture,
  StepStatus,
  type WorkflowExample,
} from "@titan/constants";
import { all } from "@titan/core";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type DaemonProcess,
  type FakeScript,
  FakeScriptSchema,
  type Run,
  type RunEvent,
  RunResultSchema,
  RunSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { captureCli } from "../support/command.ts";
import { stopOwnedDaemon } from "../support/daemon.ts";
import { serverReady, spawnServer } from "./server-process.ts";

async function assertExampleNode(run: Run, id: string, script: FakeScript): Promise<void> {
  const node = run.nodes[id];
  assert.ok(node);
  assert.equal(node.state, StepStatus.Passed);
  assert.equal(node.attempt, 1);
  assert.equal(node.refutations, 0);
  const folder = resolve(run.root, RunFile.Steps, id, `${RunFile.AttemptPrefix}${node.attempt}`);
  for (const [name, phase] of Object.entries(node.phases)) {
    assert.equal(phase.completed, true);
    assert.equal(phase.executions, 1);
    assert.ok(await exists(resolve(folder, name + RunFile.TaskSuffix)));
  }
  const step = run.plan.nodes.find((entry) => entry.id === id);
  assert.ok(step);
  const action = step.do;
  assert.ok("persona" in action);
  const { persona, task } = action;
  const expected = script.answers.find((entry) => entry.persona === persona && entry.task === task);
  assert.ok(expected);
  assert.deepEqual(node.output, expected.answer);
  assert.deepEqual(node.phases[ExecutionPhase.Worker]?.answer, expected.answer);
  for (const [index, check] of step.falsify.entries()) {
    assert.ok("persona" in check);
    const { persona, task } = check;
    const answer = script.answers.find((entry) => entry.persona === persona && entry.task === task);
    assert.ok(answer);
    assert.deepEqual(
      node.phases[`${ExecutionPhase.FalsifierPrefix}${index}`]?.answer,
      answer.answer,
    );
  }
  assert.equal(node.snapshot, resolve(folder, RunFile.Candidate));
  assert.ok(await exists(resolve(folder, RunFile.CandidateHash)));
}

async function assertExampleRecord(run: Run, source: Buffer, script: FakeScript): Promise<void> {
  assert.equal(run.state, RunStatus.Passed);
  assert.deepEqual(
    await readFileBytes(resolve(run.root, RunFile.Workflow), IoLimit.DataBytes),
    source,
  );
  assert.deepEqual(run.config.value.backends?.fake?.script, script);
  const [board, events] = await all([
    () => lstat(resolve(run.root, BoardFile.Journal)),
    () => lstat(resolve(run.root, BoardFile.Events)),
  ]);
  assert.ok(board.isFile() && events.isFile());
  assert.deepEqual([events.dev, events.ino], [board.dev, board.ino]);
  let previous = 0;
  let last: RunEvent | undefined;
  for await (const event of new RunStore(run.root).events(run.version)) {
    assert.equal(event.id, previous + 1);
    if (!previous) assert.equal(event.type, RunEventKind.Created);
    previous = event.id;
    last = event;
  }
  assert.equal(previous, run.version);
  assert.equal(last?.type, RunEventKind.Passed);
  assert.deepEqual(last?.state.nodes, run.nodes);
  for (const id of Object.keys(run.nodes)) await assertExampleNode(run, id, script);
  const report = (
    await readFileBytes(resolve(run.root, RunArtifactFile.Result), IoLimit.ResponseBytes)
  ).toString();
  const result = RunResultSchema.parse(
    JSON.parse(report.slice(report.indexOf("{"), report.lastIndexOf("}") + 1)),
  );
  assert.equal(result.run_id, run.run_id);
  assert.equal(result.workflow_id, run.workflow_id);
  assert.equal(result.workflow_revision, run.workflow_revision);
  assert.equal(result.name, run.plan.workflow.name);
  assert.equal(result.goal, run.plan.workflow.goal);
  assert.equal(result.state, RunStatus.Passed);
  assert.deepEqual(
    result.steps,
    Object.fromEntries(
      Object.entries(run.nodes).map(([id, node]) => [
        id,
        {
          state: node.state,
          attempt: node.attempt,
          refutations: node.refutations,
          evidence: node.evidence,
        },
      ]),
    ),
  );
  const tips = run.plan.nodes.filter(
    (step) => !run.plan.nodes.some((node) => node.needs?.includes(step.id)),
  );
  assert.deepEqual(
    result.outputs,
    Object.fromEntries(tips.map((step) => [step.id, run.nodes[step.id]?.output])),
  );
}

function comparableExample(run: Run) {
  return Object.fromEntries(
    Object.entries(run.nodes).map(([id, node]) => [
      id,
      {
        state: node.state,
        output: node.output,
        evidence: node.evidence,
        attempts: node.attempt,
        phases: Object.fromEntries(
          Object.entries(node.phases).map(([name, phase]) => [name, phase.answer]),
        ),
      },
    ]),
  );
}

export async function workflowExample(
  example: WorkflowExample,
  mutation = ExampleMutation.None,
  cli = resolve(Packaging.CliSource),
  assets = resolve("."),
  automatic = false,
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    const file = `${Packaging.Examples}/${example}${ExampleFixture.WorkflowSuffix}`;
    const answers = `${Packaging.Answers}/${example}${ExampleFixture.AnswersSuffix}`;
    const source = await readFileBytes(resolve(assets, file), IoLimit.DataBytes);
    const original = FakeScriptSchema.parse(
      Bun.YAML.parse((await readFileBytes(resolve(assets, answers), IoLimit.DataBytes)).toString()),
    );
    const script = mutation === ExampleMutation.Missing ? { ...original, answers: [] } : original;
    await mkdir(resolve(project, Packaging.Examples), { recursive: true });
    await mkdir(resolve(project, Packaging.Answers));
    await writeFile(resolve(project, file), source);
    await writeFile(
      resolve(project, answers),
      Buffer.from(
        Bun.YAML.stringify(
          mutation === ExampleMutation.Malformed ? { ...script, version: 2 } : script,
        ),
      ),
    );
    const checked = await captureCli(
      cli,
      [CliCommand.Check, file, ProbeOption.Home, home],
      project,
    );
    assert.equal(checked.code, ExitCode.Success, checked.error.toString());
    assert.equal(checked.output.toString().trim(), "ok");
    assert.equal(await exists(home), false);
    return exampleProcess(project, home, file, answers, source, script, mutation, cli, automatic);
  });
}

async function exampleProcess(
  project: string,
  home: string,
  file: string,
  answers: string,
  source: Buffer,
  script: FakeScript,
  mutation: ExampleMutation,
  cli: string,
  automatic: boolean,
) {
  const server = automatic ? undefined : spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
  try {
    if (server) assert.ok(await waitUntil(() => serverReady(home, server.pid)));
    const run = async () => {
      const result = await captureCli(
        cli,
        [
          CliCommand.Run,
          file,
          ProbeOption.Harness,
          Backend.Fake,
          ProbeOption.FakeScript,
          answers,
          ProbeOption.Home,
          home,
        ],
        project,
      );
      const code =
        mutation === ExampleMutation.None
          ? ExitCode.Success
          : mutation === ExampleMutation.Missing
            ? ExitCode.Blocked
            : ExitCode.Input;
      assert.equal(result.code, code, result.error.toString() + result.output.toString());
      return result;
    };
    const first = await run();
    if (mutation === ExampleMutation.Malformed) {
      await assertNoExampleRun(home, automatic);
      assert.equal(await exists(resolve(project, BoardFile.Runs)), false);
      return true;
    }
    if (mutation === ExampleMutation.Missing) {
      const blocked = await humanExample(first.output);
      assert.equal(blocked.state, RunStatus.Blocked);
      assert.ok(
        Object.values(blocked.nodes).every((node) => node.attempt === 1 && node.refutations === 0),
      );
      assert.ok(
        Object.values(blocked.nodes).every(
          (node) => (node.phases[ExecutionPhase.Worker]?.executions ?? 0) === 0,
        ),
      );
      return true;
    }
    const firstRun = await humanExample(first.output);
    const secondRun = await humanExample((await run()).output);
    assert.equal(firstRun.root, resolve(project, BoardFile.Runs, firstRun.run_id));
    assert.equal(secondRun.root, resolve(project, BoardFile.Runs, secondRun.run_id));
    assert.notEqual(firstRun.run_id, secondRun.run_id);
    assert.equal(firstRun.workflow_id, secondRun.workflow_id);
    assert.equal(firstRun.workflow_revision, secondRun.workflow_revision);
    assert.deepEqual(comparableExample(firstRun), comparableExample(secondRun));
    await assertExampleRecord(firstRun, source, script);
    await assertExampleRecord(secondRun, source, script);
    assert.deepEqual(await readFileBytes(resolve(project, file), IoLimit.DataBytes), source);
    return true;
  } finally {
    await stopExampleServer(home, server);
  }
}

export async function humanExample(output: Buffer): Promise<Run> {
  const lines = output.toString().trimEnd().split("\n");
  const start = lines.indexOf("{");
  assert.ok(start >= 0);
  const printed = lines.splice(0, start);
  const result = lines.at(-1) === "}" ? undefined : lines.pop();
  const run = RunSchema.parse(JSON.parse(lines.join("\n")));
  if (run.state === RunStatus.Passed || run.state === RunStatus.Failed)
    assert.equal(result, resolve(run.root, RunArtifactFile.Result));
  else assert.equal(result, undefined);
  let index = 0;
  for await (const event of new RunStore(run.root).events(run.version)) {
    const [id, type, ...data] = (printed[index] ?? "").split(" ");
    assert.equal(id, String(event.id));
    assert.equal(type, event.type);
    assert.deepEqual(JSON.parse(data.join(" ")), event.data);
    index++;
  }
  assert.equal(printed.length, run.version);
  assert.equal(index, run.version);
  return run;
}

async function assertNoExampleRun(home: string, automatic: boolean): Promise<void> {
  if (automatic) assert.equal(await exists(home), false);
  else assert.equal((await createRunClient(home).list()).runs.length, 0);
}

async function stopExampleServer(home: string, server: DaemonProcess | undefined): Promise<void> {
  if (!server) return stopOwnedDaemon(home);
  if (server.exitCode === null) server.kill(ProcessSignal.Terminate);
  await server.exited;
}

export function automaticWorkflowExample(
  example: WorkflowExample,
  mutation = ExampleMutation.None,
  cli = resolve(Packaging.CliSource),
  assets = resolve("."),
) {
  return workflowExample(example, mutation, cli, assets, true);
}
