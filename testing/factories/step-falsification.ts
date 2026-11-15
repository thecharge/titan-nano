import { strict as assert } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import { Backend, ExecutionPhase, RunFile, TaskOutcome, Verdict } from "@titan/constants";
import { settle } from "@titan/core";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { AgentSpec, FakeHandler, ScriptCheck } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

const personas = {
  writer: { description: "Writes", role: "Solve", tools: ["Write"] },
  skeptic: { description: "Checks", role: "Refute" },
};
function persona(task: string) {
  return { persona: "skeptic", task };
}
const survived = { verdict: Verdict.Survived, evidence: "Checked the candidate" };

function answers(check: (spec: AgentSpec, prompt: string) => unknown): FakeHandler {
  return async (spec, prompt) => {
    if (spec.writable) {
      await writeFile(resolve(spec.cwd, "a.txt"), "delivered");
      return { json: { done: true } };
    }
    return { json: check(spec, prompt), session_id: `session-${spec.invocation_id}` };
  };
}

function script(code: number, stdout: string, stderr: string): ScriptCheck {
  return async () => ({
    exit_code: code,
    stdout: Buffer.from(stdout),
    stderr: Buffer.from(stderr),
  });
}

async function execute(falsify: unknown[], backend: FakeBackend, scripts?: ScriptCheck) {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(() => backend, {}, scripts ? { scripts } : {});
    const run = await engine.create({
      project,
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: {
          defaults: { max_attempts: 1 },
          recovery: { max_retries: 1, base_delay_s: 0.001, max_delay_s: 0.002, jitter_ratio: 0 },
        },
      }),
      plan: validateWorkflow({
        name: "Falsification",
        goal: "Deliver a checked file",
        personas,
        steps: [{ id: "a", do: { persona: "writer", task: "Solve" }, falsify }],
      }),
      backend: Backend.Fake,
      client_id: "falsify",
      submission_id: "falsify",
    });
    await engine.start(run.run_id);
    const node = run.nodes.a;
    assert.ok(node);
    const record = async (name: string) =>
      readFile(
        resolve(
          run.root,
          RunFile.Steps,
          "a",
          `${RunFile.AttemptPrefix}1`,
          `${name}${RunFile.TaskSuffix}`,
        ),
        "utf8",
      );
    return { node: structuredClone(node), task: await taskOf(record) };
  });
}

async function taskOf(record: (name: string) => Promise<string>) {
  const tasks: Record<string, string> = {};
  for (const name of [
    ExecutionPhase.Worker,
    `${ExecutionPhase.FalsifierPrefix}0`,
    `${ExecutionPhase.FalsifierPrefix}1`,
  ]) {
    const [outcome] = await settle([() => record(name)]);
    tasks[name] = outcome?.status === TaskOutcome.Fulfilled ? outcome.value : "";
  }
  return tasks;
}

function summary(result: Awaited<ReturnType<typeof execute>>): string {
  return [result.node.state, ...result.node.evidence].join("|");
}

export async function allFalsifiersSurvive(verdict: string, code: number, output: string) {
  return summary(
    await execute(
      [persona("Refute"), { script: "check" }],
      new FakeBackend(answers(() => ({ verdict, evidence: "persona evidence" }))),
      script(code, output, ""),
    ),
  );
}

export async function oneFalsifierRefutes(
  verdict: string,
  code: number,
  stdout: string,
  stderr: string,
) {
  return summary(
    await execute(
      [persona("Refute"), { script: "check" }],
      new FakeBackend(answers(() => ({ verdict, evidence: "persona evidence" }))),
      script(code, stdout, stderr),
    ),
  );
}

export async function refutedWithoutEvidence(second: unknown) {
  let asks = 0;
  const result = await execute(
    [persona("Refute")],
    new FakeBackend(
      answers(() => {
        asks++;
        return asks === 1 ? { verdict: Verdict.Refuted, evidence: "" } : second;
      }),
    ),
  );
  return `${asks} ${result.node.state}`;
}

export async function falsifierTask(party: string) {
  const result = await execute(
    [persona("Refute"), persona("Probe")],
    new FakeBackend(answers(() => survived)),
  );
  const parsed = JSON.parse(result.task[party] || "{}");
  return {
    keys: Object.keys(parsed).sort(),
    goal: parsed.goal,
    task: parsed.task,
    step_task: parsed.step_task ?? null,
    candidate: parsed.candidate ?? null,
  };
}

export async function falsifierIsolation(retryChecker: boolean, party: string) {
  const prompts = new Map<string, string>();
  let asks = 0;
  const resumed: [string, string][] = [];
  const backend = new FakeBackend(async (spec, prompt, signal, sink) => {
    prompts.set(spec.invocation_id, prompt);
    if (!spec.writable) asks++;
    return answers(() =>
      retryChecker && asks === 1 ? { verdict: Verdict.Refuted, evidence: "" } : survived,
    )(spec, prompt, signal, sink);
  });
  const resume = backend.resume.bind(backend);
  backend.resume = async (id, spec) => {
    resumed.push([id, spec.invocation_id]);
    return resume(id, spec);
  };
  await execute([persona("Refute")], backend);
  const invocation = `a/1/${party}`;
  const own = `session-${invocation}`;
  const mine = resumed.filter((call) => call[1] === invocation);
  return {
    resumed_own: mine.some((call) => call[0] === own),
    resumed_foreign: mine.some((call) => call[0] !== own),
    keys: Object.keys(JSON.parse(String(prompts.get(invocation)))).sort(),
  };
}
