import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeBackend } from "@titan/backend-claude";
import {
  AgentTool,
  Backend,
  ClaudeEventKind,
  ExecutionPhase,
  ExitCode,
  type NativeToolTransport,
  Packaging,
  RunStatus,
  SdkProcessFixture,
  type SnapshotMutation,
  type VendorStubMode,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import {
  agentSpec,
  observeVendorContinuation,
  observeVendorIdentity,
  observeVendorIsolation,
  observeVendorRecovery,
  observeVendorRetry,
  observeVendorSession,
  observeVendorSessionBytes,
  vendorRecoveryWorkflow,
} from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { PersonaInspectionSchema, RunSchema, type SdkProbePaths } from "@titan/types";
import { runCliCommand, stopCommand } from "../support/command.ts";
import { prepareSdkProject, seedNativeSkill } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function claudePersona(
  transport: NativeToolTransport,
  skill: boolean,
  grep: boolean,
  model: string,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory(async (root) => {
    const { home, project } = await prepareSdkProject(
      root,
      Backend.Claude,
      0,
      false,
      paths.vendors,
      transport,
    );
    await seedNativeSkill(project);
    const base = vendorRecoveryWorkflow("claude_persona_contract");
    const tools = grep ? [AgentTool.Read, AgentTool.Grep] : [AgentTool.Read];
    const skills = skill ? ["linked"] : [];
    const workflow = {
      ...base,
      personas: {
        ...base.personas,
        checker: { ...base.personas.checker, tools, skills, model },
      },
      steps: base.steps.map((step) => ({ ...step, files: ["DELIVERED.txt"] })),
    };
    const path = join(project, "claude-persona.json");
    await writeFile(path, Buffer.from(JSON.stringify(workflow)));
    const cli = paths.cli ?? Packaging.CliSource;
    const daemon = spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
    const passed = skill && grep && model === "stub-persona-model";
    try {
      assert.ok(
        await waitUntil(() => serverReady(home, daemon.pid), SdkProcessFixture.ObserveAttempts),
      );
      const run = RunSchema.parse(
        await runCliCommand(
          cli,
          home,
          ["run", path, "--project", project, "--backend", Backend.Claude, "--watch"],
          passed ? ExitCode.Success : ExitCode.Blocked,
        ),
      );
      const reference = run.persona_references?.checker;
      assert.ok(reference);
      const inspection = PersonaInspectionSchema.parse(
        await runCliCommand(cli, home, ["persona", "show", reference]),
      );
      const recorded = inspection.versions[0]?.persona;
      assert.deepEqual(recorded?.tools, tools);
      assert.deepEqual(recorded?.skills ?? [], skills);
      assert.equal(recorded?.model, model);
      assert.equal(
        run.workspace_skills?.files.some(
          (file) => file.name === "linked" && file.path === "SKILL.md",
        ) ?? false,
        skill,
      );
      const phases = run.nodes.deliver?.phases;
      assert.equal(phases?.[ExecutionPhase.Worker]?.completed, true);
      assert.equal(phases?.[`${ExecutionPhase.FalsifierPrefix}0`]?.completed, passed);
      return run.state === (passed ? RunStatus.Passed : RunStatus.Blocked);
    } finally {
      await stopCommand(daemon);
    }
  });
}

function backend(cwd: string) {
  const backend = new ClaudeBackend(({ prompt, options }) => {
    const env = { PATH: process.env.PATH, HOME: cwd, CLAUDE_CONFIG_DIR: cwd };
    return query({
      prompt,
      options: {
        ...options,
        pathToClaudeCodeExecutable: join(import.meta.dir, "../fixtures/vendors/claude-0.3.329.mjs"),
        executable: "bun",
        env,
      },
    });
  });
  return backend;
}

export async function claudeTransport(resume: boolean, mode: VendorStubMode) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorSession(backend(cwd), cwd, resume, mode),
  );
}

export async function claudeIsolation(cancel: boolean, reverse: boolean) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorIsolation(backend(cwd), cwd, cancel, reverse),
  );
}

export async function claudeContinuation(separate: boolean, mutation: SnapshotMutation) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorContinuation(backend(cwd), cwd, separate, mutation),
  );
}

export async function claudeRecovery(restart: boolean, allowance: number, task?: string) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorRecovery(() => backend(cwd), Backend.Claude, cwd, restart, allowance, task),
  );
}

export async function claudeIdentity(separate: boolean, mode: VendorStubMode) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorIdentity(backend(cwd), cwd, separate, mode),
  );
}

export async function claudeRetryRecovery(
  worker: boolean,
  task: VendorStubMode,
  allowance: number,
) {
  return withTemporaryDirectory(async (root) =>
    observeVendorRetry(() => backend(root), Backend.Claude, root, worker, task, allowance),
  );
}

export async function claudeRetryFields(event: unknown) {
  const native = Object.assign(
    { type: ClaudeEventKind.System, subtype: ClaudeEventKind.ApiRetry },
    event,
  );
  let closed = 0;
  let observed = 0;
  const backend = new ClaudeBackend(
    () =>
      Object.assign(
        (async function* () {
          yield native;
        })(),
        {
          close() {
            closed++;
          },
        },
      ) as ReturnType<NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>>,
  );
  const session = await backend.start(agentSpec(process.cwd()));
  try {
    const error = await thrownBy(() =>
      session.send(
        "retry",
        async (event) => {
          assert.deepEqual(event.data, native);
          observed++;
        },
        new AbortController().signal,
      ),
    );
    assert.ok(error instanceof OperationalError);
    assert.equal(closed, 1);
    assert.equal(observed, 1);
    return { code: error.code, retryable: error.retryable, delay: error.retryAfterMs };
  } finally {
    await session.close();
  }
}

export async function claudeFixtureBytes(oversized: boolean, resume: boolean) {
  return withTemporaryDirectory(async (cwd) => {
    const result = await observeVendorSessionBytes(backend(cwd), cwd, oversized, resume);
    return { completed: result.completed, calls: result.calls, stopped: result.stopped };
  });
}
