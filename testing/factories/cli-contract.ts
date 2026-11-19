import { expect, spyOn } from "bun:test";
import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  BoardFile,
  BoardLimit,
  ExecutionPhase,
  ExitCode,
  FakeDefaultFixture,
  GroupExecutionFixture,
  IoLimit,
  RunArtifactFile,
  RunEventKind,
  RunFile,
  RunResultFormat,
  RunStatus,
  StepStatus,
  Verdict,
} from "@titan/constants";
import { all } from "@titan/core";
import { FakeMessage } from "@titan/messages";
import { call, startServer } from "@titan/server";
import { readBytes, readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { Run, RunStateView } from "@titan/types";
import {
  EventPageSchema,
  FailedRunResultSchema,
  FakeScriptSchema,
  RunEventSchema,
  RunResultSchema,
  RunSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { exists } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices, renderOutput } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";

import { runCliCommand } from "../support/command.ts";
import { checkedWorkflow } from "./hardening.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export const cliWorkflowDelivery = async () => {
  const home = await mkdtemp(resolve(tmpdir(), "titan-cli-home-"));
  const project = await mkdtemp(resolve(tmpdir(), "titan-cli-project-"));
  const file = resolve(project, "workflow.yaml");
  const personas = {
    worker: { description: "Worker", role: "Write a result" },
    checker: { description: "Checker", role: "Refute the result" },
  };
  const step = {
    id: "one",
    do: { persona: "worker", task: "Solve" },
    falsify: [{ persona: "checker", task: "Refute" }],
  };
  const workflow = {
    name: "CLI check",
    goal: "A checked result",
    limits: { max_parallel: 2 },
    personas,
    steps: [step],
  };
  await writeFile(file, Bun.YAML.stringify(workflow));
  const server = await startServer(home, () => createFakeBackend());
  const output: unknown[] = [];
  const main = createCli({
    ...defaultServices,
    output: (value) => output.push(JSON.stringify(value)),
  });
  const args = ["--home", home, "--project", project, "--json"];
  try {
    for (const command of [
      [],
      ["--version"],
      ["--help"],
      ["guide"],
      ["schema", "workflow"],
      ["schema", "config"],
      ["config", file],
      ["doctor"],
      ["backends"],
      ["check", file],
      ["run", file, "--dry-run"],
    ])
      expect(
        await main([
          ...command,
          ...(["config", "doctor", "check", "run"].includes(command[0] ?? "") ? args : ["--json"]),
        ]),
      ).toBe(0);
    expect(
      await main([
        "run",
        file,
        "--backend",
        "fake",
        "--watch",
        "--client-id",
        "cli-test",
        "--submission-id",
        "once",
        "--max-parallel",
        "2",
        ...args,
      ]),
    ).toBe(0);
    const result = JSON.parse(String(output.at(-1))) as RunStateView;
    expect(result.state).toBe("passed");
    for (const command of ["runs", "status", "events", "artifacts", "cancel"])
      expect(
        await main([
          command,
          ...(command === "runs" ? [] : [result.run_id]),
          "--home",
          home,
          "--json",
        ]),
      ).toBe(0);
    expect(await main(["status", result.run_id, "--watch", "--home", home, "--json"])).toBe(0);
    await expect(main(["resume", result.run_id, "--home", home, "--json"])).rejects.toThrow(
      "terminal",
    );
    await expect(main(["pause", result.run_id, "--home", home, "--json"])).rejects.toThrow(
      "terminal",
    );
    for (const harness of ["codex", "claude"]) {
      expect(
        await main(["install", "--no-model", "--harness", harness, "--project", project, "--json"]),
      ).toBe(0);
      expect(
        await main(["install", "--no-model", "--harness", harness, "--project", project, "--json"]),
      ).toBe(0);
    }
    await expect(
      main(["install", "--no-model", "--harness", "other", "--project", project, "--json"]),
    ).rejects.toThrow("harness");
    await expect(main(["worker", "--json"])).rejects.toThrow("not built");
    await expect(main(["unknown", ...args])).rejects.toThrow("Unknown");
    await expect(main(["mcp", "--json"])).rejects.toThrow("protocol");
    await expect(main(["run", file, ...args])).rejects.toThrow("No agent tool was detected");
    await expect(main(["check", ...args])).rejects.toThrow("workflow");
    await expect(main(["status", "--json"])).rejects.toThrow("run ID");
    await expect(
      main(["run", file, "--backend", "fake", "--config", file, ...args]),
    ).rejects.toThrow();
  } finally {
    await server.stop();
    await rm(home, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  }
};
export const cliServeLifecycle = async () => {
  const home = await mkdtemp(resolve(tmpdir(), "titan-cli-serve-"));
  const child = Bun.spawn(
    [process.execPath, "apps/cli/src/main.ts", "serve", "--home", home, "--json"],
    { stdout: "pipe", stderr: "pipe" },
  );
  try {
    const [, stdout, stderr] = await all([
      async () => {
        try {
          await assertCliServerReady(child, home);
        } finally {
          child.kill("SIGTERM");
        }
      },
      () => readBytes(child.stdout, IoLimit.DataBytes),
      () => readBytes(child.stderr, IoLimit.DataBytes),
    ]);
    expect(await child.exited).toBe(0);
    expect(stderr.length).toBe(0);
    expect(JSON.parse(stdout.toString())).toMatchObject({ ready: true, home });
  } finally {
    child.kill("SIGTERM");
    await child.exited;
    await rm(home, { recursive: true, force: true });
  }
};
export const cliEntrypointDiagnostics = async () => {
  const { runEntry } = await import("../../apps/cli/src/main.ts");
  const output: unknown[] = [];
  const errors: unknown[] = [];
  const writeOutput = (value: unknown) => output.push(value);
  const writeError = (value: unknown) => errors.push(value);
  expect(await runEntry(["schema", "unknown", "--json"], writeOutput, writeError)).toBe(2);
  expect(output).toHaveLength(1);
  expect(JSON.parse(String(output[0]))).toMatchObject({ data: null, error: { code: "arguments" } });
  expect(errors).toEqual([]);
  expect(await runEntry(["schema", "unknown"], writeOutput, writeError)).toBe(2);
  expect(errors).toHaveLength(1);
  expect(await runEntry(["--version", "--json"])).toBe(0);
  const closedPipe = new Error("Downstream reader closed");
  const write = spyOn(process.stdout, "write").mockImplementationOnce((_chunk, callback) => {
    if (typeof callback === "function") callback(closedPipe);
    return false;
  });
  try {
    expect(await runEntry(["--version", "--json"], writeOutput, writeError)).toBe(
      ExitCode.Transport,
    );
    expect(output).toHaveLength(1);
    expect(errors.at(-1)).toBe(closedPipe.message);
  } finally {
    write.mockRestore();
  }
  await expect(
    runEntry(["schema", "unknown", "--json"], () => {
      throw closedPipe;
    }),
  ).rejects.toBe(closedPipe);
  const { renderOutput } = await import("../../apps/cli/src/bootstrap.ts");
  const rendered: string[] = [];
  renderOutput("message", false, (value) => rendered.push(String(value)));
  renderOutput({ ready: true }, false, (value) => rendered.push(String(value)));
  expect(rendered).toEqual(["message", '{\n  "ready": true\n}']);
};
export const cliRuntimeComposition = async () => {
  const { createRunClient } = await import("@titan/server/client");
  const home = await mkdtemp(resolve(tmpdir(), "titan-runtime-home-"));
  const project = await mkdtemp(resolve(tmpdir(), "titan-runtime-project-"));
  let ready: (() => void) | undefined;
  let stop: (() => void) | undefined;
  const started = new Promise<void>((done) => {
    ready = done;
  });
  const stopping = new Promise<void>((done) => {
    stop = done;
  });
  const personas = {
    worker: { description: "Worker", role: "Solve" },
    checker: { description: "Checker", role: "Refute" },
  };
  const step = {
    id: "one",
    do: { persona: "worker", task: "Solve" },
    falsify: [{ persona: "checker", task: "Refute" }],
  };
  const workflow = {
    name: "Composition",
    goal: "Check the installed composition",
    personas,
    steps: [step],
  };
  const previousHome = process.env.TITAN_HOME;
  const registry = resolve(project, "registry-file");
  await writeFile(registry, "unavailable registry");
  process.env.TITAN_HOME = registry;
  const running = defaultServices.serve(
    home,
    () => ready?.(),
    () => stopping,
  );
  try {
    await started;
    const run = await createRunClient(home).submit({
      project,
      backend: "fake",
      client_id: "composition-test",
      submission_id: "one",
      workflow,
    });
    expect(run.run_id).toBeString();
  } finally {
    stop?.();
    await running;
    if (previousHome === undefined) delete process.env.TITAN_HOME;
    else process.env.TITAN_HOME = previousHome;
    await rm(home, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  }
};

export async function cliBranchFailure(workflow: unknown, failed: string | null) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    const file = resolve(project, "workflow.yaml");
    const original = Buffer.from(
      `# Original workflow source α\n${Bun.YAML.stringify(workflow)}`.replaceAll("\n", "\r\n"),
    );
    await writeFile(file, original);
    const workers: string[] = [];
    const evidence = "Independent check refuted this branch";
    const backend = new FakeBackend(async (spec) => {
      const [step] = spec.invocation_id.split("/");
      expect(step).toBeString();
      if (step !== failed) await Bun.sleep(GroupExecutionFixture.AnswerMilliseconds);
      if (spec.writable) {
        workers.push(String(step));
        return { json: { note: FakeMessage.Response } };
      }
      return {
        json: {
          verdict: step === failed ? Verdict.Refuted : Verdict.Survived,
          evidence: step === failed ? evidence : FakeMessage.Completed,
        },
      };
    });
    const server = await startServer(home, () => backend);
    let output: unknown;
    const rendered: string[] = [];
    const main = createCli({
      ...defaultServices,
      output: (value, json) => {
        output = value;
        renderOutput(value, json, (line) => rendered.push(String(line)));
      },
    });
    try {
      const code = await main([
        "run",
        file,
        "--backend",
        Backend.Fake,
        "--watch",
        "--home",
        home,
        "--project",
        project,
      ]);
      const run = RunSchema.parse(output);
      await assertBranchResult(run, failed, evidence);
      expect(rendered.at(-1)).toBe(resolve(run.root, RunArtifactFile.Result));
      expect(await readFileBytes(file, IoLimit.DataBytes)).toEqual(original);
      expect(await readFileBytes(resolve(run.root, RunFile.Workflow), IoLimit.DataBytes)).toEqual(
        original,
      );
      return { code, state: run.state, workers: workers.sort() };
    } finally {
      await server.stop();
    }
  });
}

async function assertBranchResult(
  run: Run,
  failed: string | null,
  evidence: string,
): Promise<void> {
  const expected = Object.fromEntries(
    Object.keys(run.nodes).map((id) => [
      id,
      id === failed
        ? StepStatus.Failed
        : failed && id === "join"
          ? StepStatus.SkippedDependency
          : StepStatus.Passed,
    ]),
  );
  expect(
    Object.fromEntries(Object.entries(run.nodes).map(([id, node]) => [id, node.state])),
  ).toEqual(expected);
  const report = (
    await readFileBytes(resolve(run.root, RunArtifactFile.Result), BoardLimit.RecordBytes)
  ).toString();
  expect(report).toContain(run.plan.workflow.name);
  expect(report).toContain(run.plan.workflow.goal);
  if (failed) {
    const detail = FailedRunResultSchema.parse(
      JSON.parse(report.slice(report.indexOf("{"), report.lastIndexOf("}") + 1)),
    );
    const steps = Object.fromEntries(
      Object.entries(run.nodes).map(([id, node]) => [
        id,
        {
          state: node.state,
          attempt: node.attempt,
          refutations: node.refutations,
          evidence: node.evidence,
        },
      ]),
    );
    expect(detail.schema_version).toBe(RunResultFormat.FailureVersion);
    expect(detail.run_id).toBe(run.run_id);
    expect(detail.workflow_id).toBe(run.workflow_id);
    expect(detail.workflow_revision).toBe(run.workflow_revision);
    expect(detail.name).toBe(run.plan.workflow.name);
    expect(detail.goal).toBe(run.plan.workflow.goal);
    expect(detail.state).toBe(RunStatus.Failed);
    expect(detail.steps).toEqual(steps);
    expect(run.nodes[failed]?.evidence).toEqual([evidence]);
    expect(run.nodes.join?.phases[ExecutionPhase.Worker]).toBeUndefined();
    expect(run.artifacts).toBeNull();
    expect(await exists(resolve(run.root, RunArtifactFile.Manifest))).toBe(false);
  } else {
    const detail = RunResultSchema.parse(
      JSON.parse(report.slice(report.indexOf("{"), report.lastIndexOf("}") + 1)),
    );
    expect(detail.state).toBe(RunStatus.Passed);
    expect(detail.run_id).toBe(run.run_id);
    expect(detail.outputs).toEqual({ join: run.nodes.join?.output });
    expect(Object.keys(detail.steps).sort()).toEqual(["a", "b", "join"]);
    expect(
      Object.values(detail.steps).every(
        (step) => step.state === StepStatus.Passed && step.attempt === 1,
      ),
    ).toBe(true);
    expect(run.artifacts).not.toBeNull();
    await assertRunRecord(run);
  }
}

async function assertCliServerReady(child: Bun.Subprocess, home: string): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!(await Bun.file(resolve(home, "server.json")).exists())) {
    expect(child.exitCode).toBe(null);
    if (Date.now() > deadline) throw new Error("Server readiness timed out");
    await Bun.sleep(10);
  }
}

export function cliResultPath(state: RunStatus, json: boolean): boolean {
  const run = {
    run_id: "run",
    root: "/project/.titan/runs/run",
    state,
    artifacts: null,
    nodes: {},
  };
  const rendered: string[] = [];
  renderOutput(run, json, (value) => rendered.push(String(value)));
  expect(rendered[0]).toBe(JSON.stringify(run, null, json ? undefined : 2));
  expect(rendered.slice(1)).toEqual(json ? [] : [resolve(run.root, RunArtifactFile.Result)]);
  return true;
}

async function assertRunRecord(run: Run): Promise<void> {
  const workflow = await readFileBytes(resolve(run.root, RunFile.Workflow), IoLimit.DataBytes);
  expect(validateWorkflow(Bun.YAML.parse(workflow.toString())).workflow).toEqual(run.plan.workflow);
  const journal = await readFileBytes(resolve(run.root, BoardFile.Journal), BoardLimit.RecordBytes);
  expect(await readFileBytes(resolve(run.root, BoardFile.Events), BoardLimit.RecordBytes)).toEqual(
    journal,
  );
  const records = journal
    .toString()
    .trim()
    .split("\n")
    .map((line) => RunEventSchema.parse(JSON.parse(line)));
  expect(records.map((event) => event.id)).toEqual(records.map((_, index) => index + 1));
  expect(records[0]?.type).toBe(RunEventKind.Created);
  expect(records.at(-1)?.type).toBe(RunEventKind.Passed);
  expect(records.at(-1)?.state.nodes).toEqual(run.nodes);
  for (const [id, node] of Object.entries(run.nodes)) {
    const folder = resolve(run.root, RunFile.Steps, id, `${RunFile.AttemptPrefix}${node.attempt}`);
    expect(await exists(resolve(folder, `${ExecutionPhase.Worker}${RunFile.TaskSuffix}`))).toBe(
      true,
    );
    expect(node.phases[ExecutionPhase.Worker]?.completed).toBe(true);
    expect(node.phases[`${ExecutionPhase.FalsifierPrefix}0`]?.completed).toBe(true);
    expect(
      await exists(resolve(folder, `${ExecutionPhase.FalsifierPrefix}0${RunFile.TaskSuffix}`)),
    ).toBe(true);
    expect(node.phases[`${ExecutionPhase.FalsifierPrefix}0`]?.answer).toEqual({
      verdict: Verdict.Survived,
      evidence: FakeMessage.Completed,
    });
    expect(node.snapshot).toBe(resolve(folder, RunFile.Candidate));
    expect(await exists(resolve(folder, RunFile.CandidateHash))).toBe(true);
  }
  const rendered: string[] = [];
  renderOutput(run, false, (value) => rendered.push(String(value)));
  expect(rendered.at(-1)).toBe(resolve(run.root, RunArtifactFile.Result));
}

export async function scriptedFakeProcess(
  parallel: boolean,
  missing: string,
  cli = resolve("apps/cli/src/main.ts"),
  watched = false,
) {
  return withTemporaryDirectory((root) => scriptedProcess(root, parallel, missing, cli, watched));
}

export async function scriptedFakeWatch(
  parallel: boolean,
  missing: string,
  cli = resolve("apps/cli/src/main.ts"),
) {
  return scriptedFakeProcess(parallel, missing, cli, true);
}

async function scriptedProcess(
  root: string,
  parallel: boolean,
  missing: string,
  cli: string,
  watched: boolean,
) {
  const home = resolve(root, "home");
  const project = resolve(root, "project");
  await mkdir(project);
  const path = resolve(project, "workflow.yaml");
  const answersPath = resolve(root, "answers.yaml");
  const workflow = checkedWorkflow();
  const first = { ...workflow.steps[0], do: { persona: "worker", task: "Solve one" } };
  const second = { ...first, id: "two", do: { persona: "worker", task: "Solve two" } };
  const steps = parallel ? [{ parallel: [second, first] }] : [first, second];
  await writeFile(path, Buffer.from(Bun.YAML.stringify({ ...workflow, steps })));
  const survived = { verdict: Verdict.Survived, evidence: "Scripted independent check" };
  const answers = [
    { persona: "worker", task: "Solve one", answer: { marker: "one" } },
    { persona: "worker", task: "Solve two", answer: { marker: "two" } },
    { persona: "checker", task: "Refute", answer: survived },
  ].filter((entry) => entry.persona !== missing);
  const script = FakeScriptSchema.parse({ version: 1, answers });
  await writeFile(answersPath, Buffer.from(Bun.YAML.stringify(script)));
  const server = spawnServer(home, cli);
  try {
    assert.ok(await waitUntil(() => serverReady(home, server.pid)));
    const submit = async (scriptFile = answersPath) =>
      RunSchema.parse(
        await runCliCommand(
          cli,
          home,
          [
            "run",
            path,
            "--project",
            project,
            "--harness",
            "fake",
            ...(missing === FakeDefaultFixture.MissingProfile ? [] : ["--fake-script", scriptFile]),
            ...(watched ? [] : ["--detach"]),
          ],
          watched && missing ? ExitCode.Blocked : ExitCode.Success,
        ),
      );
    const initial = await submit();
    if (watched) assert.equal(initial.state, missing ? RunStatus.Blocked : RunStatus.Passed);
    assert.equal(
      RunSchema.parse(await runCliCommand(cli, home, ["status", initial.run_id])).run_id,
      initial.run_id,
    );
    assert.equal(
      EventPageSchema.parse(await runCliCommand(cli, home, ["events", initial.run_id])).run_id,
      initial.run_id,
    );
    await writeFile(answersPath, Buffer.from("version: 2\nanswers: []\n"));
    const run = await settledScriptedRun(home, initial.run_id, Boolean(missing));
    assert.deepEqual(
      run.config.value.backends?.fake?.script,
      missing === FakeDefaultFixture.MissingProfile ? undefined : script,
    );
    if (missing) {
      const node = run.nodes.one;
      assert.equal(node?.attempt, 1);
      assert.equal(node?.refutations, 0);
      const phase =
        node?.phases[
          missing === "checker" ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker
        ];
      assert.equal(phase?.executions, 0);
      assert.equal(phase?.session_id, null);
      assert.equal(phase?.retries, 0);
      assert.deepEqual(phase?.usage, []);
      assert.deepEqual(node?.evidence, []);
      assert.equal(Boolean(node?.phases[ExecutionPhase.Worker]?.completed), missing === "checker");
      assert.ok(phase?.error?.includes("fake backend has no script for task:"));
      return true;
    }
    const report = (
      await readFileBytes(resolve(run.root, RunArtifactFile.Result), IoLimit.ResponseBytes)
    ).toString();
    const result = RunResultSchema.parse(
      JSON.parse(report.slice(report.indexOf("{"), report.lastIndexOf("}") + 1)),
    );
    const oneOutput = { one: { marker: "one" } };
    const twoOutput = { two: { marker: "two" } };
    assert.deepEqual(result.outputs, { ...twoOutput, ...(parallel ? oneOutput : {}) });
    assert.deepEqual(run.nodes.one?.output, oneOutput.one);
    assert.deepEqual(run.nodes.two?.output, twoOutput.two);
    await writeFile(answersPath, Buffer.from(Bun.YAML.stringify(script)));
    const alternatePath = resolve(root, "alternate.yaml");
    const alternateAnswers = script.answers.map((entry) => ({
      ...entry,
      answer: entry.persona === "worker" ? { marker: "alternate" } : entry.answer,
    }));
    const alternate = { version: script.version, answers: alternateAnswers };
    await writeFile(alternatePath, Buffer.from(Bun.YAML.stringify(alternate)));
    const [repeatInitial, alternateInitial] = await all([
      () => submit(),
      () => submit(alternatePath),
    ]);
    const [repeated, other] = await all([
      () => settledScriptedRun(home, repeatInitial.run_id, false),
      () => settledScriptedRun(home, alternateInitial.run_id, false),
    ]);
    assert.deepEqual(
      Object.values(other.nodes).map((node) => node.output),
      [{ marker: "alternate" }, { marker: "alternate" }],
    );
    assert.deepEqual(
      Object.values(repeated.nodes).map((node) => node.output),
      Object.values(run.nodes).map((node) => node.output),
    );
    assert.deepEqual(
      Object.values(repeated.nodes).map((node) => node.evidence),
      Object.values(run.nodes).map((node) => node.evidence),
    );
    return true;
  } finally {
    if (server.exitCode === null) server.kill("SIGTERM");
    await server.exited;
  }
}

async function settledScriptedRun(home: string, id: string, blocked: boolean) {
  const state = blocked ? RunStatus.Blocked : RunStatus.Passed;
  const terminal = [RunStatus.Passed, RunStatus.Failed, RunStatus.Blocked];
  assert.ok(
    await waitUntil(async () =>
      terminal.includes(RunSchema.parse(await call(home, `/runs/${id}`)).state),
    ),
  );
  const run = RunSchema.parse(await call(home, `/runs/${id}`));
  assert.equal(run.state, state);
  return run;
}
