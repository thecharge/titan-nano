import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { runResultChunks } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, ExecutionPhase, RunFile, TaskOutcome, Verdict } from "@titan/constants";
import { settle } from "@titan/core";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { validateWorkflow } from "@titan/workflow";

const personas = {
  writer: { description: "Writes", role: "Solve", tools: ["Write"] },
  skeptic: { description: "Checks", role: "Refute" },
};

function backendFor(refuted: number, evidenceOf: (attempt: number) => string): FakeBackend {
  let checks = 0;
  return new FakeBackend(async (spec) => {
    if (spec.writable) {
      await writeFile(resolve(spec.cwd, "a.txt"), "delivered");
      return { json: { done: true } };
    }
    checks++;
    return {
      json:
        checks <= refuted
          ? { verdict: Verdict.Refuted, evidence: evidenceOf(checks) }
          : { verdict: Verdict.Survived, evidence: "Checked the candidate" },
      session_id: `session-${spec.invocation_id}`,
    };
  });
}

async function retryRun(max: number, refuted: number, evidenceOf: (attempt: number) => string) {
  return withTemporaryDirectory(async (project) => {
    const backend = backendFor(refuted, evidenceOf);
    const engine = new Engine(() => backend);
    const run = await engine.create({
      project,
      config: await resolveConfig({
        home: resolve(project, "home"),
        project,
        overrides: {
          recovery: { max_retries: 1, base_delay_s: 0.001, max_delay_s: 0.002, jitter_ratio: 0 },
        },
      }),
      plan: validateWorkflow({
        name: "Retry",
        goal: "Deliver a checked file",
        personas,
        steps: [
          {
            id: "a",
            do: { persona: "writer", task: "Solve" },
            falsify: [{ persona: "skeptic", task: "Refute" }],
            max_attempts: max,
          },
        ],
      }),
      backend: Backend.Fake,
      client_id: "retry",
      submission_id: "retry",
    });
    await engine.start(run.run_id);
    const attempts: string[] = [];
    for (let attempt = 1; attempt <= max; attempt++) {
      const [outcome] = await settle([
        () =>
          readFile(
            resolve(
              run.root,
              RunFile.Steps,
              "a",
              `${RunFile.AttemptPrefix}${attempt}`,
              `${ExecutionPhase.Worker}${RunFile.TaskSuffix}`,
            ),
            "utf8",
          ),
      ]);
      attempts.push(outcome?.status === TaskOutcome.Fulfilled ? outcome.value : "");
    }
    const chunks: Buffer[] = [];
    for await (const chunk of runResultChunks(run)) chunks.push(Buffer.from(chunk));
    return {
      state: run.nodes.a?.state,
      attempt: run.nodes.a?.attempt,
      attempts,
      result: Buffer.concat(chunks).toString("utf8"),
    };
  });
}

export async function survivesOnSecondAttempt(evidence: string, max: number) {
  const found = await retryRun(max, 1, () => evidence);
  return `${found.state}|${found.attempt}|${found.attempts[1]?.includes(evidence) ?? false}`;
}

export async function neverSurvives(max: number, refuted: number) {
  const found = await retryRun(max, refuted, (attempt) => `flaw-${attempt}`);
  return `${found.state}|${found.attempt}|${found.result.includes(`flaw-${max}`)}`;
}
