import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { object, resolveConfig, workflowSettings } from "@titan/config";
import {
  Backend,
  BoardFile,
  ErrorCode,
  ExecutionPhase,
  GroupExecutionFixture,
  IoLimit,
  RunFile,
  RunStatus,
  StepStatus,
  Verdict,
  WorkflowSourceFixture,
  WorkspaceModeSetting,
} from "@titan/constants";
import { FakeMessage } from "@titan/messages";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type NodeState, PersonaSchema } from "@titan/types";
import { checkAnswer, validateWorkflow } from "@titan/workflow";
import { exists } from "@titan/workspace";
import { createFakeBackend } from "../support/backend.ts";

export async function validatedAnswer(
  outputs: Record<string, Record<string, unknown>>,
  value: unknown,
) {
  const persona = PersonaSchema.parse({
    description: "Writer",
    role: "Produce a typed result",
    outputs,
  });
  checkAnswer(persona, value);
  return value;
}

export async function compiledWorkflow(value: unknown) {
  const plan = validateWorkflow(value);
  return plan.nodes.map((node) => [node.id, node.needs]);
}

export async function workflowInputs(value: unknown, code: string | null, fragments: string[]) {
  if (code === null) {
    assert.ok(validateWorkflow(value).nodes.length > 1);
    return true;
  }
  const error = await thrownBy(() => validateWorkflow(value));
  assert.equal(Reflect.get(Object(error), "code"), code);
  for (const fragment of fragments)
    assert.ok(String(Reflect.get(Object(error), "message")).includes(fragment));
  return true;
}

export async function workflowCheck(value: unknown, valid: boolean, fragments: string[]) {
  if (valid) {
    assert.ok(validateWorkflow(value).nodes.length);
    return true;
  }
  const error = await thrownBy(() => validateWorkflow(value));
  assert.equal(Reflect.get(Object(error), "code"), ErrorCode.InvalidWorkflow);
  for (const fragment of fragments)
    assert.ok(String(Reflect.get(Object(error), "message")).includes(fragment));
  return true;
}

function recordGroupBoundaries(
  nodes: Record<string, NodeState>,
  version: number,
  starts: Map<string, number>,
  finishes: Map<string, number>,
  checked: boolean,
): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.phases[ExecutionPhase.Worker]?.executions && !starts.has(id)) starts.set(id, version);
    const completed = checked
      ? node.state === StepStatus.Passed
      : node.phases[ExecutionPhase.Worker]?.completed;
    if (completed && !finishes.has(id)) finishes.set(id, version);
  }
}

export async function groupedRun(
  raw: unknown,
  first: string,
  second: string,
  maximum: number,
  checked = true,
) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    const plan = validateWorkflow(raw);
    const overrides = {
      workspace: { mode: WorkspaceModeSetting.Isolated },
      limits: { max_parallel: maximum },
    };
    const config = await resolveConfig({
      home,
      project,
      workflow: workflowSettings(plan.workflow),
      overrides,
    });
    const backend = new FakeBackend(async (spec) => {
      await Bun.sleep(GroupExecutionFixture.AnswerMilliseconds);
      return {
        json: spec.writable
          ? { note: FakeMessage.Response }
          : { verdict: Verdict.Survived, evidence: FakeMessage.Completed },
      };
    });
    const engine = new Engine(() => backend);
    const run = await engine.create({
      project,
      plan,
      config,
      backend: Backend.Fake,
      client_id: "group-contract",
      submission_id: "group-contract",
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Passed);
    assert.equal(
      Object.values(run.nodes).every(
        (node) => node.state === StepStatus.Passed && node.attempt === 1 && node.refutations === 0,
      ),
      true,
    );
    const starts = new Map<string, number>();
    const finishes = new Map<string, number>();
    for await (const event of new RunStore(run.root).events(run.version))
      recordGroupBoundaries(event.state.nodes, event.id, starts, finishes, checked);
    const began = starts.get(second);
    const ended = finishes.get(first);
    assert.ok(began !== undefined);
    assert.ok(ended !== undefined);
    return began < ended;
  });
}

export async function keptInput(raw: unknown, refute: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    const plan = validateWorkflow(raw);
    const config = await resolveConfig({
      home,
      project,
      workflow: workflowSettings(plan.workflow),
    });
    const kept = "the clock is in UTC";
    const discarded = "discarded candidate";
    let consumer = false;
    const backend = new FakeBackend(async (spec, prompt) => {
      const [step, attempt] = spec.invocation_id.split("/");
      const rejected = refute && step === "cause" && attempt === "1";
      if (!spec.writable)
        return {
          json: {
            verdict: rejected ? Verdict.Refuted : Verdict.Survived,
            evidence: FakeMessage.Completed,
          },
        };
      if (step === "cause") return { json: { root_cause: rejected ? discarded : kept } };
      assert.deepEqual(object(JSON.parse(prompt)).inputs, { cause: kept });
      assert.equal(prompt.includes(discarded), false);
      consumer = true;
      return { json: { note: kept } };
    });
    const engine = new Engine(() => backend);
    const run = await engine.create({
      project,
      plan,
      config,
      backend: Backend.Fake,
      client_id: "input-contract",
      submission_id: "input-contract",
    });
    await engine.start(run.run_id);
    const producer = run.nodes.cause;
    const consumerState = run.nodes.fix;
    assert.ok(producer && consumerState);
    const task = resolve(
      run.root,
      RunFile.Steps,
      "fix",
      `${RunFile.AttemptPrefix}1`,
      `${ExecutionPhase.Worker}${RunFile.TaskSuffix}`,
    );
    if (consumer) {
      const recorded = object(
        JSON.parse((await readFileBytes(task, IoLimit.DataBytes)).toString()),
      );
      assert.deepEqual(recorded.inputs, { cause: kept });
      assert.deepEqual(consumerState.output, { note: kept });
      assert.equal(consumerState.state, StepStatus.Passed);
      assert.equal(consumerState.phases[ExecutionPhase.Worker]?.executions, 1);
    } else {
      assert.equal(consumerState.state, StepStatus.SkippedDependency);
      assert.equal(consumerState.phases[ExecutionPhase.Worker], undefined);
      assert.equal(await exists(task), false);
      assert.equal(run.artifacts, null);
    }
    return {
      passed: run.state === RunStatus.Passed,
      attempt: producer.attempt,
      refutations: producer.refutations,
      consumer,
    };
  });
}

export async function workflowSourceCreation(mode: WorkflowSourceFixture): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const plan = validateWorkflow(workflow);
    const source = Buffer.from(
      mode === WorkflowSourceFixture.Json
        ? JSON.stringify(workflow, null, 2)
        : `# Exact source α\r\n${Bun.YAML.stringify(workflow).replaceAll("\n", "\r\n")}`,
    );
    const input =
      mode === WorkflowSourceFixture.TooLarge
        ? Buffer.alloc(IoLimit.DataBytes + 1)
        : mode === WorkflowSourceFixture.Mismatch
          ? Buffer.from(JSON.stringify({ ...workflow, goal: "Changed source" }))
          : source;
    let calls = 0;
    const engine = new Engine(() => {
      calls++;
      return createFakeBackend();
    });
    const options = {
      project,
      plan,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "source-creation",
      submission_id: "one",
      workflow_source: input,
    };
    if (mode === WorkflowSourceFixture.TooLarge || mode === WorkflowSourceFixture.Mismatch) {
      await assert.rejects(() => engine.create(options), { code: ErrorCode.InvalidWorkflow });
      assert.equal(calls, 0);
      assert.equal(await exists(resolve(project, BoardFile.Runs)), false);
      return true;
    }
    const original = Buffer.from(input);
    const creating = engine.create(options);
    input.fill(0);
    const run = await creating;
    assert.deepEqual(
      await readFileBytes(resolve(run.root, RunFile.Workflow), IoLimit.DataBytes),
      original,
    );
    assert.ok(calls > 0);
    return true;
  });
}
