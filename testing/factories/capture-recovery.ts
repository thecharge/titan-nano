import { strict as assert } from "node:assert";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  BoardFile,
  ErrorCode,
  ExecutionPhase,
  FileEncoding,
  RunEventKind,
  RunFile,
  RunFormat,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type AgentBackend,
  type FakeHandler,
  RunEventSchema,
  type ScriptCheck,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function captureRecovery(
  script: boolean,
  fail: boolean,
  close = false,
  split = false,
) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    let turns = 0;
    let checkers = 0;
    async function deliver() {
      turns++;
      await writeFile(resolve(project, "side-effect.txt"), String(turns));
      if (fail && !close && (!split || turns === 2))
        await symlink("side-effect.txt", resolve(project, "unsafe-link"));
      return { exit_code: 0, stdout: Buffer.from("received"), stderr: Buffer.alloc(0) };
    }
    const factory = () =>
      receiptBackend(async (spec, prompt) => {
        if (spec.writable && JSON.parse(prompt).reconciliation) return { json: { ok: true } };
        if (spec.writable && spec.invocation_id.startsWith("source/"))
          return { json: { parts: [1, 2] } };
        if (spec.writable) {
          await deliver();
          return { json: { ok: true } };
        }
        checkers++;
        return { json: { verdict: Verdict.Survived, evidence: "Checked" } };
      }, close);
    const scripts: ScriptCheck = async () => deliver();
    const config = await resolveConfig({ home: resolve(root, "home"), project });
    let engine = new Engine(factory, {}, { scripts });
    const run = await engine.create({
      project,
      config,
      backend: Backend.Fake,
      client_id: "capture",
      submission_id: "capture",
      plan: validateWorkflow({
        name: "capture",
        goal: "Preserve successful execution when checkpoint capture fails",
        personas: {
          writer: { description: "Writer", role: "Write", tools: [AgentTool.Write] },
          skeptic: { description: "Checker", role: "Check" },
        },
        steps: [
          ...(split
            ? [
                {
                  id: "source",
                  do: { persona: "writer", task: "parts" },
                  falsify: [{ persona: "skeptic", task: "check" }],
                },
              ]
            : []),
          {
            id: "deliver",
            ...(split ? { split: { parts: "source.parts" } } : {}),
            do: script ? { script: "deliver" } : { persona: "writer", task: "deliver" },
            falsify: [{ persona: "skeptic", task: "check" }],
          },
        ],
      }),
    });
    await engine.start(run.run_id);
    const first = await engine.snapshot(run.run_id);
    const node = first.nodes.deliver;
    const phase = node?.phases[ExecutionPhase.Worker];
    assert.ok(node && phase);
    assert.equal(first.schema_version, RunFormat.CaptureReceipts);
    assert.equal(turns, split ? 2 : 1);
    assert.deepEqual(
      phase.answer,
      script
        ? { exit_code: 0, stdout: "received", stderr: "" }
        : split
          ? [{ ok: true }, { ok: true }]
          : { ok: true },
    );
    const events = (await engine.events(run.run_id)).events;
    const received = events.filter((event) => event.type === RunEventKind.PhaseReceived);
    assert.equal(received.length, split ? 2 : 1);
    if (!fail) {
      assert.equal(first.state, RunStatus.Passed);
      assert.equal(phase.completed, true);
      assert.equal(phase.capture_pending, undefined);
      assert.equal(checkers, split ? 2 : 1);
      return true;
    }
    assert.equal(first.state, RunStatus.Blocked);
    assert.equal(phase.capture_pending, true);
    assert.equal(phase.completed, false);
    assert.equal(phase.executions, script || split ? 0 : 1);
    assert.equal(phase.usage.length, script || split ? 0 : 1);
    assert.equal(checkers, split ? 1 : 0);
    if (!close) await rm(resolve(project, "unsafe-link"));
    await writeFile(resolve(project, "side-effect.txt"), "External edit after capture failure");
    engine = new Engine(factory, {}, { scripts });
    await engine.load(run.root);
    await engine.resume(run.run_id);
    const resumed = await engine.snapshot(run.run_id);
    const pending = resumed.nodes.deliver;
    if (close) {
      assert.equal(resumed.state, RunStatus.Blocked);
      assert.ok(pending?.reconciliations);
      assert.deepEqual(pending.reconciliations[0]?.phases[ExecutionPhase.Worker], phase);
      assert.equal(pending.phases[ExecutionPhase.Worker]?.capture_pending, true);
      assert.equal(turns, 1);
      assert.equal(checkers, 0);
      assert.equal((await engine.usage(run.run_id)).executions, 2);
      return true;
    }
    if (!script && !split && !close) {
      assert.equal(resumed.state, RunStatus.Passed);
      assert.ok(pending?.reconciliations);
      assert.equal(pending.reconciliations.length, 1);
      assert.deepEqual(pending.reconciliations[0]?.phases[ExecutionPhase.Worker], phase);
      assert.equal(pending.attempt, 1);
      assert.equal(pending.refutations, 0);
      assert.equal(turns, 1);
      assert.equal(checkers, 1);
      assert.equal(
        await readFile(resolve(project, "side-effect.txt"), FileEncoding.Utf8),
        "External edit after capture failure",
      );
      assert.equal((await engine.usage(run.run_id)).executions, 3);
      return true;
    }
    assert.equal(resumed.state, RunStatus.Blocked);
    assert.ok(pending);
    assert.equal(pending.snapshot, null);
    assert.equal(pending.attempt, 1);
    assert.equal(pending.refutations, 0);
    assert.deepEqual(pending.evidence, []);
    assert.deepEqual(pending.phases[ExecutionPhase.Worker], phase);
    assert.equal(turns, split ? 2 : 1);
    assert.equal(checkers, split ? 1 : 0);
    assert.equal(
      await readFile(resolve(project, "side-effect.txt"), FileEncoding.Utf8),
      "External edit after capture failure",
    );
    assert.equal(
      (await engine.events(run.run_id)).events.filter(
        (event) => event.type === RunEventKind.PhaseReceived,
      ).length,
      split ? 2 : 1,
    );
    return true;
  });
}

export async function sealedCaptureRecovery(
  script: boolean,
  fault: string | null,
  split = false,
  completed = false,
) {
  return withTemporaryDirectory(async (root) => {
    const reconciling =
      !script &&
      !split &&
      ["live", "live-restart", "archive", "archive-manifest"].includes(fault ?? "");
    const project = resolve(root, "project");
    await mkdir(project);
    let workers = 0;
    let checks = 0;
    let scriptChecks = 0;
    let generations = 0;
    const config = await resolveConfig({ home: resolve(root, "home"), project });
    const factory = () =>
      new FakeBackend(async (spec, prompt) => {
        if (spec.writable && JSON.parse(prompt).reconciliation) {
          generations++;
          assert.equal(spec.cwd, project);
          assert.deepEqual(JSON.parse(prompt).reconciliation.original_result, { ok: true });
          assert.equal(await readFile(resolve(project, "output.txt"), "utf8"), "External edit");
          return { json: { reconciled: true } };
        }
        if (spec.invocation_id.startsWith("source/"))
          return {
            json: spec.writable
              ? { parts: [1, 2] }
              : { verdict: Verdict.Survived, evidence: "Checked" },
          };
        if (!spec.writable) {
          checks++;
          return { json: { verdict: Verdict.Survived, evidence: "Checked" } };
        }
        workers++;
        await writeFile(resolve(spec.cwd, "output.txt"), "Received result");
        return { json: { ok: true } };
      });
    const scripts: ScriptCheck = async (command) => {
      if (command === "verify") {
        scriptChecks++;
        return { exit_code: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
      }
      workers++;
      await writeFile(resolve(project, "output.txt"), "Received result");
      return { exit_code: 0, stdout: Buffer.from("received"), stderr: Buffer.alloc(0) };
    };
    let engine = new Engine(factory, {}, { scripts });
    const run = await engine.create({
      project,
      config,
      backend: Backend.Fake,
      client_id: "sealed-capture",
      submission_id: "sealed-capture",
      plan: validateWorkflow({
        name: "sealed-capture",
        goal: "Recover a sealed checkpoint without repeating worker execution",
        personas: {
          writer: { description: "Writer", role: "Write", tools: [AgentTool.Write] },
          skeptic: { description: "Checker", role: "Check" },
        },
        steps: [
          ...(split
            ? [
                {
                  id: "source",
                  do: { persona: "writer", task: "parts" },
                  falsify: [{ persona: "skeptic", task: "check" }],
                },
              ]
            : []),
          {
            id: "deliver",
            ...(split ? { split: { parts: "source.parts" } } : {}),
            checks: ["verify"],
            do: script ? { script: "deliver" } : { persona: "writer", task: "deliver" },
            falsify: [{ persona: "skeptic", task: "check" }],
          },
        ],
      }),
    });
    await engine.start(run.run_id);
    assert.equal((await engine.snapshot(run.run_id)).state, RunStatus.Passed);
    assert.equal(workers, split ? 2 : 1);
    assert.equal(checks, 1);
    assert.equal(scriptChecks, 1);
    const journal = resolve(run.root, BoardFile.Journal);
    const lines = (await readFile(journal, FileEncoding.Utf8)).trimEnd().split("\n");
    const seal = lines.findIndex((line) => {
      const event = RunEventSchema.parse(JSON.parse(line));
      const worker = event.state.nodes.deliver?.phases[ExecutionPhase.Worker];
      return completed
        ? event.type === RunEventKind.PhaseCompleted && worker?.completed && worker.candidate_hash
        : event.type === RunEventKind.PhaseCaptured && worker?.capture_pending;
    });
    assert.ok(seal >= 0);
    const retained = RunEventSchema.parse(JSON.parse(lines[seal] ?? ""));
    const received = retained.state.nodes.deliver?.phases[ExecutionPhase.Worker];
    assert.ok(received?.candidate_hash);
    assert.equal(received.capture_pending, completed ? undefined : true);
    assert.equal(received.completed, completed);
    await writeFile(journal, `${lines.slice(0, seal + 1).join("\n")}\n`);
    const folder = resolve(run.root, RunFile.Steps, "deliver", `${RunFile.AttemptPrefix}1`);
    const candidate = resolve(folder, RunFile.Candidate);
    if (fault === "candidate")
      await writeFile(resolve(candidate, "output.txt"), "Changed evidence");
    if (fault === "live" || reconciling)
      await writeFile(resolve(project, "output.txt"), "External edit");
    if (fault === "manifest") await rm(resolve(folder, RunFile.CandidateHash));
    engine = new Engine(factory, {}, { scripts });
    await engine.load(run.root);
    await engine.resume(run.run_id);
    const resumed = await engine.snapshot(run.run_id);
    const node = resumed.nodes.deliver;
    const phase = node?.phases[ExecutionPhase.Worker];
    assert.ok(node && phase);
    assert.equal(workers, split ? 2 : 1);
    assert.equal(node.attempt, 1);
    assert.equal(node.refutations, 0);
    assert.deepEqual(node.evidence, []);
    if (reconciling) {
      assert.equal(resumed.state, RunStatus.Passed);
      assert.equal(resumed.schema_version, RunFormat.Reconciliation);
      assert.deepEqual(node.reconciliations?.[0]?.phases[ExecutionPhase.Worker], received);
      assert.deepEqual(phase.answer, { reconciled: true });
      assert.equal(generations, 1);
      assert.equal(checks, 2);
      assert.equal(scriptChecks, 2);
      assert.equal((await engine.usage(run.run_id)).executions, 3);
      if (fault === "live") return true;
      const recorded = (await readFile(journal, "utf8")).trimEnd().split("\n");
      const generation = recorded.findIndex(
        (line) =>
          RunEventSchema.parse(JSON.parse(line)).type === RunEventKind.ReconciliationStarted,
      );
      assert.ok(generation >= 0);
      await writeFile(journal, `${recorded.slice(0, generation + 1).join("\n")}\n`);
      if (fault === "archive")
        await writeFile(resolve(candidate, "output.txt"), "Changed archived evidence");
      if (fault === "archive-manifest") await rm(resolve(folder, RunFile.CandidateHash));
      engine = new Engine(factory, {}, { scripts });
      await engine.load(run.root);
      await engine.resume(run.run_id);
      assert.equal(
        (await engine.snapshot(run.run_id)).state,
        fault === "live-restart" ? RunStatus.Passed : RunStatus.Blocked,
      );
      assert.equal(workers, 1);
      assert.equal(generations, fault === "live-restart" ? 2 : 1);
      assert.equal(await readFile(resolve(project, "output.txt"), "utf8"), "External edit");
      return true;
    }
    assert.deepEqual(phase.answer, received.answer);
    assert.deepEqual(phase.usage, received.usage);
    assert.equal(phase.executions, received.executions);
    assert.equal(phase.retries, received.retries);
    assert.equal(phase.candidate_hash, received.candidate_hash);
    assert.equal(resumed.state, fault ? RunStatus.Blocked : RunStatus.Passed);
    assert.equal(checks, fault ? 1 : 2);
    assert.equal(scriptChecks, fault ? 1 : 2);
    assert.equal(phase.completed, !fault);
    assert.equal(phase.capture_pending, fault ? true : undefined);
    assert.equal(
      await readFile(resolve(project, "output.txt"), FileEncoding.Utf8),
      fault === "live" ? "External edit" : "Received result",
    );
    const events = (await engine.events(run.run_id)).events;
    assert.equal(
      events.filter((event) => event.type === RunEventKind.PhaseReceived).length,
      split ? 2 : 1,
    );
    assert.equal(
      events.filter((event) => event.type === RunEventKind.PhaseCaptured).length,
      split ? 2 : 1,
    );
    return true;
  });
}

function receiptBackend(handler: FakeHandler, close: boolean): AgentBackend {
  const backend = new FakeBackend(handler);
  return {
    id: backend.id,
    specificationVersion: backend.specificationVersion,
    capabilities: backend.capabilities,
    validateTurn: (spec, prompt) => backend.validateTurn(spec, prompt),
    resume: (id, spec) => backend.resume(id, spec),
    async start(spec) {
      const session = await backend.start(spec);
      return {
        ...session,
        async close() {
          await session.close();
          if (close && spec.writable && spec.execution === 1)
            throw new OperationalError(ErrorCode.SnapshotChanged, "Cleanup refused");
        },
      };
    },
  };
}
