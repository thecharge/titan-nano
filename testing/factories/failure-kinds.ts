import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { runResultChunks } from "@titan/board";
import { resolveConfig } from "@titan/config";
import { Backend, type FailureKind, Verdict } from "@titan/constants";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { validateWorkflow } from "@titan/workflow";

const personas = {
  writer: { description: "Writes", role: "Solve", tools: ["Write"] },
  skeptic: { description: "Checks", role: "Refute" },
};

async function failureRun(max: number, answers: unknown[]) {
  return withTemporaryDirectory(async (project) => {
    let checks = 0;
    const backend = new FakeBackend(async (spec) => {
      if (spec.writable) {
        await writeFile(resolve(spec.cwd, "a.txt"), "delivered");
        return { json: { done: true } };
      }
      const answer = answers[checks] ?? { verdict: Verdict.Survived, evidence: "Checked" };
      checks++;
      return { json: answer, session_id: `session-${spec.invocation_id}` };
    });
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
        name: "Kinds",
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
      client_id: "kinds",
      submission_id: "kinds",
    });
    await engine.start(run.run_id);
    const chunks: Buffer[] = [];
    for await (const chunk of runResultChunks(run)) chunks.push(Buffer.from(chunk));
    return {
      state: run.nodes.a?.state,
      attempt: run.nodes.a?.attempt,
      checks,
      result: Buffer.concat(chunks).toString("utf8"),
    };
  });
}

export async function failureKindCounts(kinds: (FailureKind | null)[]) {
  const found = await failureRun(
    kinds.length,
    kinds.map((kind) => ({
      verdict: Verdict.Refuted,
      evidence: "loops",
      ...(kind === null ? {} : { failure: kind }),
    })),
  );
  return [...found.result.matchAll(/^- (.+)$/gm)].map((line) => line[1]).join(",");
}

export async function failureKindAnswer(failure: string) {
  const found = await failureRun(2, [{ verdict: Verdict.Refuted, evidence: "loops", failure }]);
  return `${found.state}|${found.attempt}|${found.checks}`;
}
