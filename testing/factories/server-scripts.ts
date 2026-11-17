import { strict as assert } from "node:assert";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  ExecutionPhase,
  FileEncoding,
  ProofAnswer,
  RequestDecision,
  RunArtifactFile,
  RunEventKind,
  RunFile,
  RunFormat,
  RunStatus,
  WorkspaceModeSetting,
} from "@titan/constants";
import { hash, newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { scopedScripts, startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type CommandProcessPort,
  type FileExecutionClaim,
  FileExecutionClaimSchema,
  NodeStateSchema,
  ObjectSchema,
  type ScriptExecution,
  ScriptExecutionSchema,
  ScriptProofReportSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { exists } from "@titan/workspace";
import { serverReady, spawnServer } from "./server-process.ts";

export async function serverScripts(
  retry: boolean,
  scriptWorker: boolean,
  decision: RequestDecision | null,
  restart: boolean,
) {
  if (decision !== RequestDecision.Approve) return serverScriptRefusal(decision);
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    const spawn = () =>
      Bun.spawn(
        [
          process.execPath,
          fileURLToPath(import.meta.resolve("../fixtures/server-scripts.ts")),
          home,
          String(retry),
        ],
        {
          stdin: "ignore",
          stdout: "ignore",
          stderr: Bun.file(resolve(root, "server.stderr")),
          timeout: 10000,
        },
      );
    let server = spawn();
    const client = createRunClient(home);
    const requests = createRequestClient(home);
    try {
      assert.ok(
        await waitUntil(() => serverReady(home, server.pid)),
        await readFile(resolve(root, "server.stderr"), FileEncoding.Utf8),
      );
      const run = await client.submit({
        project,
        backend: Backend.Fake,
        client_id: "scripts",
        submission_id: "scripts",
        workflow: {
          name: "scripts",
          goal: "Run only the approved scripts",
          personas: {
            writer: { description: "Writer", role: "Write", tools: [AgentTool.Write] },
            skeptic: { description: "Checker", role: "Check" },
          },
          steps: [
            {
              id: "write",
              do: scriptWorker
                ? { script: "printf good > note.txt" }
                : { persona: "writer", task: "write" },
              falsify: [{ persona: "skeptic", task: "check" }],
              checks: scriptWorker
                ? []
                : ['test "$(cat note.txt)" = good || { printf needs-correction; exit 1; }'],
              max_attempts: 2,
            },
          ],
        },
      });
      assert.ok(
        await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Waiting),
      );
      assert.equal(
        (await client.events(run.run_id)).events.filter(
          (event) => event.type === RunEventKind.ScriptStarted,
        ).length,
        0,
      );
      if (scriptWorker) assert.equal(await exists(resolve(project, "note.txt")), false);
      if (restart) {
        server.kill("SIGTERM");
        await server.exited;
        server = spawn();
        assert.ok(await waitUntil(() => serverReady(home, server.pid)));
      }
      if (decision !== null) {
        const rounds = retry ? 2 : 1;
        for (let round = 0; round < rounds; round++) {
          const page = await requests.list({ run_id: run.run_id });
          assert.ok(
            (await client.get(run.run_id)).state !== RunStatus.Blocked,
            JSON.stringify({
              run: await client.get(run.run_id),
              events: (await client.events(run.run_id)).events.filter(
                (event) => event.type === RunEventKind.StepBlocked,
              ),
            }),
          );
          const pending = page.requests
            .map((entry) => entry.request)
            .find((request) => request.answer === null);
          assert.ok(pending, "The script must name its pending scoped permission");
          await requests.answer(
            {
              run_id: run.run_id,
              request_id: pending.request_id,
              version: pending.version,
              decision,
              reason: "Reviewed exact command and directory",
              client_id: "owner",
            },
            ApprovalLevel.Human,
          );
          assert.ok(
            await waitUntil(async () => {
              const state = (await client.get(run.run_id)).state;
              return (
                state === RunStatus.Passed ||
                state === RunStatus.Blocked ||
                (state === RunStatus.Waiting &&
                  (await requests.list({ run_id: run.run_id })).requests.some(
                    (request) =>
                      request.request.answer === null &&
                      request.request.request_id !== pending.request_id,
                  ))
              );
            }),
          );
        }
      }
      const final = await client.get(run.run_id);
      if (decision === RequestDecision.Approve)
        assert.equal(
          final.state,
          RunStatus.Passed,
          JSON.stringify(
            (await client.events(run.run_id)).events.filter(
              (event) => event.type === RunEventKind.StepBlocked,
            ),
          ),
        );
      const events = (await client.events(run.run_id)).events;
      const phases = events
        .filter((event) => event.type === RunEventKind.ExecutionStarted)
        .map((event) => ObjectSchema.parse(event.data).phase);
      assert.equal((await client.usage(run.run_id)).executions, phases.length);
      const task = resolve(
        final.root,
        RunFile.Steps,
        "write",
        `${RunFile.AttemptPrefix}2`,
        `${ExecutionPhase.Worker}${RunFile.TaskSuffix}`,
      );
      return {
        state: final.state,
        builders: phases.filter((phase) => phase === ExecutionPhase.Worker).length,
        checkers: phases.filter((phase) => String(phase).startsWith(ExecutionPhase.FalsifierPrefix))
          .length,
        fed:
          (await exists(task)) &&
          (await readFile(task, FileEncoding.Utf8)).includes("needs-correction"),
        scripts: events.filter((event) => event.type === RunEventKind.ScriptStarted).length,
        text: (await exists(resolve(project, "note.txt")))
          ? await readFile(resolve(project, "note.txt"), FileEncoding.Utf8)
          : null,
      };
    } finally {
      if (server.exitCode === null) server.kill("SIGTERM");
      await server.exited;
    }
  });
}

async function serverScriptRefusal(decision: RequestDecision | null) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const server = await startServer(home, () => new FakeBackend());
    try {
      const client = createRunClient(home);
      const requests = createRequestClient(home);
      const run = await client.submit({
        project,
        backend: Backend.Fake,
        client_id: "scripts",
        submission_id: "scripts",
        workflow: {
          name: "scripts",
          goal: "Refuse unapproved scripts",
          personas: {},
          steps: [
            {
              id: "write",
              do: { script: "printf good > note.txt" },
              falsify: [{ script: "true" }],
            },
          ],
        },
      });
      assert.ok(
        await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Waiting),
      );
      if (decision !== null) {
        const pending = (await requests.list({ run_id: run.run_id })).requests[0]?.request;
        assert.ok(pending);
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: pending.request_id,
            version: pending.version,
            decision,
            reason: "Refused command",
            client_id: "owner",
          },
          ApprovalLevel.Human,
        );
        assert.ok(
          await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Blocked),
        );
      }
      const events = (await client.events(run.run_id)).events;
      assert.equal(await exists(resolve(project, "note.txt")), false);
      assert.equal(
        events.filter((event) => event.type === RunEventKind.ExecutionStarted).length,
        0,
      );
      return {
        state: (await client.get(run.run_id)).state,
        builders: 0,
        checkers: 0,
        fed: false,
        scripts: events.filter((event) => event.type === RunEventKind.ScriptStarted).length,
        text: null,
      };
    } finally {
      await server.stop();
    }
  });
}

export async function scriptWorkerFlow(exit: number, checks: boolean) {
  return withTemporaryDirectory(async (root) => {
    let starts = 0;
    const scripts = scopedScripts(() => engine, 1, 1, {
      spawn() {
        starts++;
        return {
          pid: 1,
          stdout: new Blob(["checked"]).stream(),
          stderr: new Blob([]).stream(),
          exited: Promise.resolve(exit),
          signalCode: null,
          kill() {},
        };
      },
      stop() {},
    });
    const engine = new Engine(
      () => new FakeBackend(),
      {},
      { scripts, runtimePaths: [resolve(root, "runtime")] },
    );
    const run = await engine.create({
      project: root,
      config: await resolveConfig({ home: resolve(root, "home"), project: root }),
      plan: validateWorkflow({
        name: "scripts",
        goal: "Keep script lifecycle evidence",
        personas: {},
        steps: [
          {
            id: "write",
            do: { script: "printf checked" },
            falsify: [{ script: "true" }],
            checks: checks ? ["true"] : [],
          },
        ],
      }),
      backend: Backend.Fake,
      client_id: "scripts",
      submission_id: "scripts",
    });
    assert.deepEqual(run.runtime_paths, ["runtime"]);
    await engine.start(run.run_id);
    for (let round = 0; round < 3 && run.state === RunStatus.Waiting; round++) {
      const request = (await engine.requests.list(run.run_id)).find(
        (entry) => entry.answer === null,
      );
      assert.ok(request);
      await engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Approve,
          reason: "Reviewed command",
        },
        { client_id: "owner", authority: ApprovalLevel.Human },
      );
      await engine.resume(run.run_id);
    }
    const usage = await engine.usage(run.run_id);
    assert.equal(usage.executions, 0);
    assert.equal(usage.reported_executions, 0);
    assert.equal(usage.unreported_executions, 0);
    const bindings = new Map<string, FileExecutionClaim>();
    for (const event of (await engine.events(run.run_id)).events) {
      if (event.type === RunEventKind.FileAccessBound) {
        const binding = FileExecutionClaimSchema.parse(event.data);
        bindings.set(binding.execution_id, binding);
      }
      if (event.type === RunEventKind.ScriptStarted) {
        const execution = ScriptExecutionSchema.strip().parse(event.data);
        assert.deepEqual(execution.file_claim, bindings.get(execution.execution_id));
      }
      if (event.type === RunEventKind.PhaseReceived) {
        const receipt = ObjectSchema.parse(event.data);
        const binding = bindings.get(String(receipt.execution_id));
        assert.ok(binding);
        assert.equal(binding.step_id, receipt.step_id);
        assert.equal(binding.attempt, receipt.attempt);
      }
    }
    for (const checkpoint of Object.values(run.nodes.write?.phases ?? {}))
      if (checkpoint.file_claim)
        assert.equal(checkpoint.execution_id, checkpoint.file_claim.execution_id);
    return { state: run.state, starts, refutations: run.nodes.write?.refutations };
  });
}

export async function scriptProcess(
  checks: boolean,
  restart: boolean,
  decision: RequestDecision | null,
  cli?: string,
  proof = false,
  goal = false,
  goalFailure = false,
) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    let server = spawnServer(home, cli, 15000);
    const client = createRunClient(home);
    const requests = createRequestClient(home);
    try {
      assert.ok(await waitUntil(() => serverReady(home, server.pid)));
      const run = await client.submit({
        project,
        backend: Backend.Fake,
        client_id: "script-process",
        submission_id: "script-process",
        workflow: {
          name: "script-process",
          goal: "Run approved commands through the installed server",
          ...(goal
            ? {
                verify: [
                  {
                    kind: "script",
                    run: goalFailure ? "exit 1" : 'test "$(cat note.txt)" = good',
                    deterministic: true,
                    timeout_s: 1,
                  },
                ],
              }
            : {}),
          personas: {},
          steps: [
            {
              id: "write",
              do: { script: "printf good > note.txt" },
              verify:
                proof && !goal
                  ? [
                      {
                        kind: "script",
                        run: 'test "$(cat note.txt)" = good',
                        deterministic: true,
                        timeout_s: 1,
                      },
                    ]
                  : [],
              checks: checks ? ['test "$(cat note.txt)" = good'] : [],
              falsify: [{ script: 'test "$(cat note.txt)" = good' }],
            },
          ],
        },
      });
      assert.ok(
        await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Waiting),
      );
      assert.equal(await exists(resolve(project, "note.txt")), false);
      if (restart) {
        server.kill("SIGTERM");
        await server.exited;
        server = spawnServer(home, cli, 15000);
        assert.ok(await waitUntil(() => serverReady(home, server.pid)));
      }
      for (
        let round = 0;
        decision !== null && round < (checks ? 3 : 2) + (proof ? 2 : 0);
        round++
      ) {
        const pending = (await requests.list({ run_id: run.run_id })).requests
          .map((entry) => entry.request)
          .find((request) => request.answer === null);
        assert.ok(pending);
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: pending.request_id,
            version: pending.version,
            decision,
            reason: "Reviewed exact command and working directory",
            client_id: "owner",
          },
          ApprovalLevel.Human,
        );
        assert.ok(
          await waitUntil(async () => {
            const current = await client.get(run.run_id);
            return (
              current.state === RunStatus.Passed ||
              current.state === RunStatus.Failed ||
              current.state === RunStatus.Blocked ||
              (current.state === RunStatus.Waiting &&
                (await requests.list({ run_id: run.run_id })).requests.some(
                  (entry) => entry.request.answer === null,
                ))
            );
          }),
        );
        if (decision === RequestDecision.Deny) break;
      }
      const final = await client.get(run.run_id);
      const node = NodeStateSchema.parse(final.nodes.write);
      assert.equal(node.attempt, 1);
      assert.equal(node.refutations, 0);
      assert.equal((await client.usage(run.run_id)).executions, 0);
      const events = (await client.events(run.run_id)).events;
      if (proof && decision === RequestDecision.Approve) {
        const answers = events.filter((event) => event.type === RunEventKind.CheckAnswered);
        assert.equal(answers.length, 1);
        assert.equal(
          ObjectSchema.parse(answers[0]?.data).answer,
          goalFailure ? ProofAnswer.NotProven : ProofAnswer.Proven,
        );
        assert.equal(final.proofs?.proven, goalFailure ? 0 : 1);
        assert.equal(final.proofs?.total, 1);
        const delivery = goalFailure ? null : await client.artifacts(run.run_id);
        if (!delivery) {
          assert.equal(final.state, RunStatus.Failed);
          await assert.rejects(client.artifacts(run.run_id));
        } else {
          assert.equal(delivery.proofs, resolve(final.root, RunArtifactFile.Proofs));
          const report = ScriptProofReportSchema.parse(
            JSON.parse(await readFile(delivery.proofs, FileEncoding.Utf8)),
          );
          assert.deepEqual(report.summary, final.proofs);
          assert.equal(report.checks.length, 1);
          if (goal) {
            assert.equal(report.checks[0]?.scope, "goal");
            assert.equal(Object.hasOwn(report.checks[0] ?? {}, "step_id"), false);
            assert.equal(Object.hasOwn(report.checks[0] ?? {}, "attempt"), false);
          }
        }
      }
      return {
        state: final.state,
        scripts: events.filter((event) => event.type === RunEventKind.ScriptStarted).length,
        text: (await exists(resolve(project, "note.txt")))
          ? await readFile(resolve(project, "note.txt"), FileEncoding.Utf8)
          : null,
      };
    } finally {
      if (server.exitCode === null) server.kill("SIGTERM");
      await server.exited;
    }
  });
}

export async function scopedScriptAdmission(
  phase: string,
  mutation: string,
  exit: number,
  mode = WorkspaceModeSetting.Live,
  timeout?: number,
  delay = 0,
) {
  return withTemporaryDirectory(async (root) => {
    let starts = 0;
    let code: string | number = exit;
    let stop: (() => void) | undefined;
    const processes: CommandProcessPort = {
      spawn(command, cwd) {
        assert.deepEqual(command.slice(-3), ["/bin/sh", "-c", "printf checked"]);
        assert.ok(command[0]?.endsWith("/sandlock"));
        assert.ok(cwd.startsWith(root));
        starts++;
        const completion = Promise.withResolvers<number>();
        const timer = setTimeout(() => completion.resolve(exit), delay);
        stop = () => {
          clearTimeout(timer);
          completion.resolve(exit);
        };
        return {
          pid: 1,
          stdout: new Blob(["checked"]).stream(),
          stderr: new Blob([]).stream(),
          exited: completion.promise,
          signalCode: null,
          kill() {},
        };
      },
      stop() {
        stop?.();
      },
    };
    const scripts = scopedScripts(() => engine, 1, 1, processes);
    const engine: Engine = new Engine(
      () => new FakeBackend(),
      {},
      {
        scripts: async (script, directory, signal, input) => {
          assert.ok(input);
          const selected = [ExecutionPhase.Worker, "check-0", "falsifier-0"].includes(phase);
          if (selected && input.phase !== phase)
            return { exit_code: 0, stdout: Buffer.from("checked"), stderr: Buffer.alloc(0) };
          const execution: ScriptExecution | undefined =
            mutation === "missing-context"
              ? undefined
              : {
                  ...input,
                  phase,
                  step_id: mutation === "missing-step" ? "other" : input.step_id,
                  attempt: mutation === "wrong-attempt" ? input.attempt + 1 : input.attempt,
                  execution_id: mutation === "wrong-execution" ? newId() : input.execution_id,
                };
          if (execution && mutation === "missing-binding") delete execution.file_claim;
          const node = run.nodes.write;
          assert.ok(node);
          if (mutation === "missing-work") node.work = null;
          if (mutation === "paused") run.state = RunStatus.Paused;
          const review = resolve(
            run.root,
            RunFile.Steps,
            "write",
            `${RunFile.AttemptPrefix}1`,
            `${RunFile.ReviewPrefix}0`,
          );
          let cwd = directory;
          if (mutation === "wrong-directory") cwd = resolve(root, "other");
          if (mutation === "review-directory") cwd = review;
          if (mutation === "project-directory") cwd = root;
          const command = mutation === "wrong-command" ? "printf other" : script;
          try {
            const result = await scripts(command, cwd, signal, execution);
            code = result.exit_code;
            return result;
          } catch (error) {
            if (error instanceof TitanError) code = error.code;
            throw error;
          }
        },
      },
    );
    const run = await engine.create({
      project: root,
      config: await resolveConfig({
        home: resolve(root, "home"),
        project: root,
        overrides: { workspace: { mode } },
      }),
      plan: validateWorkflow({
        name: "scripts",
        goal: "Check scoped dispatch",
        personas: {},
        steps: [
          {
            id: "write",
            max_attempts: 1,
            do: {
              script: "printf checked",
              ...(timeout === undefined ? {} : { timeout_s: timeout }),
            },
            falsify: [
              {
                script: "printf checked",
                ...(timeout === undefined ? {} : { timeout_s: timeout }),
              },
            ],
            checks: ["printf checked"],
          },
        ],
      }),
      backend: Backend.Fake,
      client_id: "scripts",
      submission_id: "scripts",
    });
    await engine.start(run.run_id);
    assert.equal(starts, 0);
    if (run.state === RunStatus.Waiting && mutation === "valid") {
      const request = (await engine.requests.list(run.run_id))[0];
      assert.ok(request);
      await engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Approve,
          reason: "Reviewed command",
        },
        { client_id: "owner", authority: ApprovalLevel.Human },
      );
      await engine.resume(run.run_id);
    }
    return { code, starts };
  });
}

export async function scriptProofFlow(
  first: number,
  second: number,
  restart: boolean,
  attempts = 1,
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    let starts = 0;
    let proofs = 0;
    let checkers = 0;
    const create = (): Engine =>
      new Engine(
        () => new FakeBackend(),
        {},
        {
          scripts: scopedScripts(() => engine, 1, 1, {
            spawn(command) {
              starts++;
              const proof = command.at(-1) === "printf proof";
              if (command.at(-1) === "printf checker") checkers++;
              const exit = proof ? (proofs++ === 0 ? first : second) : 0;
              return {
                pid: 1,
                stdout: new Blob(["checked"]).stream(),
                stderr: new Blob([]).stream(),
                exited: Promise.resolve(exit),
                signalCode: null,
                kill() {},
              };
            },
            stop() {},
          }),
        },
      );
    let engine = create();
    const run = await engine.create({
      project: root,
      config: await resolveConfig({ home, project: root }),
      plan: validateWorkflow({
        name: "script-proof",
        goal: "Run retained proof checks before falsification",
        personas: {},
        steps: [
          {
            id: "write",
            max_attempts: attempts,
            do: { script: "printf worker" },
            verify: [{ kind: "script", run: "printf proof", deterministic: true, timeout_s: 1 }],
            falsify: [{ script: "printf checker" }],
          },
        ],
      }),
      backend: Backend.Fake,
      client_id: "proofs",
      submission_id: "proofs",
    });
    await engine.start(run.run_id);
    for (let round = 0; round < 8 && engine.get(run.run_id).state === RunStatus.Waiting; round++) {
      const request = (await engine.requests.list(run.run_id)).find(
        (entry) => entry.answer === null,
      );
      assert.ok(request);
      if (restart && proofs > 0) {
        engine = create();
        await engine.load(run.root);
      }
      await engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Approve,
          reason: "Reviewed exact proof invocation",
        },
        { client_id: "owner", authority: ApprovalLevel.Human },
      );
      await engine.resume(run.run_id);
    }
    const final = engine.get(run.run_id);
    assert.equal(final.schema_version, RunFormat.ScriptCandidates);
    const answered = (await engine.events(run.run_id)).events.filter(
      (event) => event.type === RunEventKind.CheckAnswered,
    );
    assert.equal(answered.length, attempts);
    const report = ScriptProofReportSchema.parse(
      JSON.parse(await readFile(resolve(final.root, RunArtifactFile.Proofs), FileEncoding.Utf8)),
    );
    assert.equal(report.history_complete, true);
    assert.equal(report.checks.length, attempts);
    assert.equal(report.summary.total, final.state === RunStatus.Passed ? 1 : 0);
    assert.equal(report.discarded_attempts.total, attempts - report.summary.total);
    assert.equal(report.summary.proven, report.summary.total);
    assert.equal(report.discarded_attempts.not_proven, report.discarded_attempts.total);
    for (const record of report.checks) {
      const output = await readFile(resolve(final.root, record.output));
      assert.equal(hash(output), record.output_hash);
      assert.equal(record.command_hash, hash("printf proof"));
      assert.equal(record.statement_hash, null);
      assert.equal(record.scope, "step");
      if (record.scope !== "step") throw new Error("Expected a step proof");
      assert.equal(record.part, null);
      assert(record.elapsed_ms >= 0);
      assert.equal(record.attempt >= 1, true);
    }
    const result = await readFile(resolve(final.root, RunArtifactFile.Result), FileEncoding.Utf8);
    assert(result.includes(`proven ${report.summary.proven} of ${report.summary.total}`));
    for (const event of answered) {
      const data = ObjectSchema.parse(event.data);
      assert.equal(data.step_id, "write");
      assert.equal(
        data.answer,
        first === 0 && second === 0 ? ProofAnswer.Proven : ProofAnswer.NotProven,
      );
    }
    assert.equal(final.nodes.write?.attempt, attempts);
    const usage = await engine.usage(run.run_id);
    assert.equal(usage.executions, 0);
    assert.equal(usage.reported_executions, 0);
    assert.equal(usage.unreported_executions, 0);
    return {
      state: final.state,
      starts,
      proofs,
      checkers,
      refutations: final.nodes.write?.refutations,
    };
  });
}

export async function scriptProofProcess(
  restart: boolean,
  decision: RequestDecision | null,
  cli?: string,
) {
  return scriptProcess(false, restart, decision, cli, true);
}

export async function goalProofProcess(restart: boolean, fail: boolean, cli?: string) {
  return scriptProcess(false, restart, RequestDecision.Approve, cli, true, true, fail);
}
