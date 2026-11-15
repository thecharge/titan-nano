import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  FileEncoding,
  LiveWorkspaceFixture as Fixture,
  Verdict,
  WorkspaceModeSetting,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { ScriptCheck } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

const personas = {
  [Fixture.Writer]: {
    description: Fixture.WriterDescription,
    role: Fixture.WriterRole,
    tools: [AgentTool.Write],
  },
  [Fixture.Skeptic]: { description: Fixture.SkepticDescription, role: Fixture.SkepticRole },
};

export async function checksNeedScripts(scripted: boolean, proof = false) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, Fixture.Project);
    await mkdir(project);
    const scripts: ScriptCheck = async () => ({
      exit_code: 0,
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
    });
    const engine = new Engine(
      () => new FakeBackend(async () => ({ json: Fixture.Answer })),
      { max_active_agents: Fixture.Agents },
      scripted ? { scripts } : {},
    );
    const run = await engine.create({
      project,
      plan: validateWorkflow({
        name: Fixture.Name,
        goal: Fixture.Goal,
        personas,
        steps: [
          {
            id: Fixture.StepOne,
            do: { persona: Fixture.Writer, task: Fixture.Task },
            falsify: [{ persona: Fixture.Skeptic, task: Fixture.Check }],
            checks: proof ? [] : [Fixture.CheckCommand],
            verify: proof
              ? [{ kind: "script", run: Fixture.CheckCommand, deterministic: true }]
              : [],
          },
        ],
      }),
      config: await resolveConfig({ home: resolve(root, Fixture.Home), project }),
      backend: Backend.Fake,
      client_id: Fixture.Client,
      submission_id: Fixture.Submission,
    });
    return run.run_id.length > 0;
  });
}

export async function loopChecks(codes: readonly number[], attempts: number) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, Fixture.Project);
    await mkdir(project);
    await writeFile(resolve(project, Fixture.First), Fixture.Old);
    let builders = 0;
    let checkers = 0;
    let checks = 0;
    let fed = false;
    const scripts: ScriptCheck = async () => {
      const code = codes[Math.min(checks, codes.length - 1)] ?? 0;
      checks++;
      return {
        exit_code: code,
        stdout: Buffer.from(code ? Fixture.CheckOutput : ""),
        stderr: Buffer.alloc(0),
      };
    };
    const engine = new Engine(
      () =>
        new FakeBackend(async (spec, prompt) => {
          if (!spec.writable) {
            checkers++;
            return { json: { verdict: Verdict.Survived, evidence: Fixture.Check } };
          }
          builders++;
          if (prompt.includes(Fixture.CheckOutput)) fed = true;
          await writeFile(resolve(spec.cwd, Fixture.First), Fixture.New);
          return { json: Fixture.Answer };
        }),
      { max_active_agents: Fixture.Agents },
      { scripts },
    );
    const run = await engine.create({
      project,
      plan: validateWorkflow({
        name: Fixture.Name,
        goal: Fixture.Goal,
        personas,
        steps: [
          {
            id: Fixture.StepOne,
            do: { persona: Fixture.Writer, task: Fixture.Task },
            falsify: [{ persona: Fixture.Skeptic, task: Fixture.Check }],
            checks: [Fixture.CheckCommand],
          },
        ],
      }),
      config: await resolveConfig({
        home: resolve(root, Fixture.Home),
        project,
        overrides: {
          workspace: { mode: WorkspaceModeSetting.Live },
          defaults: { max_attempts: attempts },
          limits: { max_parallel: Fixture.Parallel },
        },
      }),
      backend: Backend.Fake,
      client_id: Fixture.Client,
      submission_id: Fixture.Submission,
    });
    await engine.start(run.run_id);
    return {
      state: run.state,
      builders,
      checkers,
      checks,
      fed,
      text: await readFile(resolve(project, Fixture.First), FileEncoding.Utf8),
    };
  });
}
