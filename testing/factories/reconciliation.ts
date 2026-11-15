import { strict as assert } from "node:assert";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  BoardFile,
  ErrorCode,
  ExecutionPhase,
  KnowledgeAttemptState,
  KnowledgeKind,
  RequestDecision,
  RunEventKind,
  RunFile,
  RunFormat,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { KnowledgeHub } from "@titan/knowledge";
import { RunnerMessage } from "@titan/messages";
import { Engine, runKnowledgeScope } from "@titan/runner";
import { runNumbers } from "@titan/server/run-numbers";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type Run, RunEventSchema, type ScriptCheck } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { knowledgeDraft } from "./knowledge.ts";

export async function reconciliationRecovery(mode: string, nested: boolean) {
  return withTemporaryDirectory(async (root) => {
    const refuted = mode === "refuted" || mode === "refuted-edit";
    const repeated = mode === "repeat-commit-failure";
    const project = resolve(root, nested ? "project/nested" : "project");
    await mkdir(project, { recursive: true });
    await writeFile(resolve(project, "note.txt"), "Original input");
    await writeFile(resolve(project, "neighbor.txt"), "Preserve neighboring file");
    let workers = 0;
    let reconciliations = 0;
    let checks = 0;
    const factory = () =>
      new FakeBackend(async (spec, prompt) => {
        assert.equal(spec.cwd, project);
        const task = JSON.parse(prompt);
        if (!spec.writable) {
          checks++;
          assert.equal(task.reconciliation.generation, repeated ? 2 : 1);
          assert.equal(
            await readFile(resolve(project, "note.txt"), "utf8"),
            mode === "refuted-edit" ? "Reconciliation edit" : "External edit",
          );
          return {
            json: {
              verdict: refuted ? Verdict.Refuted : Verdict.Survived,
              evidence: "Fresh reconciliation checked",
            },
          };
        }
        if (task.reconciliation) {
          reconciliations++;
          assert.equal(task.task, RunnerMessage.ReconcileReceived);
          assert.equal(task.reconciliation.original_task, "Deliver once");
          assert.deepEqual(task.reconciliation.original_result, { received: true });
          assert.equal(
            await readFile(resolve(task.reconciliation.original_input, "note.txt"), "utf8"),
            "Original input",
          );
          assert.equal(
            await readFile(resolve(task.reconciliation.current_input, "note.txt"), "utf8"),
            "External edit",
          );
          if (mode === "refuted-edit")
            await writeFile(resolve(project, "note.txt"), "Reconciliation edit");
          if (repeated && reconciliations === 1)
            await symlink("note.txt", resolve(project, "unsafe-link"));
          return {
            json: { reconciled: true },
            usage: { input_tokens: 7, output_tokens: 3, cost_usd: 0.02 },
          };
        }
        workers++;
        await writeFile(resolve(project, "note.txt"), "Received worker edit");
        await symlink("note.txt", resolve(project, "unsafe-link"));
        return {
          json: { received: true },
          usage: { input_tokens: 5, output_tokens: 2, cost_usd: 0.01 },
        };
      });
    const config = await resolveConfig({
      home: resolve(root, "home"),
      project,
      overrides: {
        defaults: { max_attempts: 1 },
        recovery: { max_retries: mode === "budget" ? 0 : 2 },
      },
    });
    let engine = new Engine(factory);
    const run = await engine.create({
      project,
      config,
      backend: Backend.Fake,
      client_id: "reconciliation",
      submission_id: mode,
      plan: validateWorkflow({
        name: "Reconciliation",
        goal: "Retain received work and reconcile external edits",
        personas: {
          writer: {
            description: "Writer",
            role: "Reconcile files",
            tools: [AgentTool.Read, AgentTool.Write],
          },
          skeptic: { description: "Checker", role: "Check fresh evidence" },
        },
        steps: [
          {
            id: "deliver",
            files: ["note.txt"],
            do: { persona: "writer", task: "Deliver once" },
            falsify: [{ persona: "skeptic", task: "Check reconciled result" }],
          },
        ],
      }),
    });
    await engine.start(run.run_id);
    const first = await engine.snapshot(run.run_id);
    assert.equal(first.state, RunStatus.Blocked);
    const received = first.nodes.deliver?.phases[ExecutionPhase.Worker];
    assert.ok(received?.capture_pending);
    assert.equal(workers, 1);
    assert.equal(reconciliations, 0);
    await rm(resolve(project, "unsafe-link"));
    await writeFile(resolve(project, "note.txt"), "External edit");
    engine = new Engine(
      factory,
      {},
      {
        async projectRun(_run, kind) {
          if (
            kind === RunEventKind.ReconciliationStarted &&
            (mode === "commit-failure" ||
              (repeated && _run.nodes.deliver?.reconciliations?.length === 2))
          )
            throw new Error("Interrupted reconciliation projection");
        },
      },
    );
    await engine.load(run.root);
    if (repeated) {
      await engine.resume(run.run_id);
      assert.equal((await engine.snapshot(run.run_id)).state, RunStatus.Blocked);
      assert.equal(reconciliations, 1);
      await rm(resolve(project, "unsafe-link"));
    }
    if (mode === "commit-failure" || repeated) {
      await assert.rejects(engine.resume(run.run_id), /Interrupted reconciliation projection/);
      assert.equal(workers, 1);
      assert.equal(reconciliations, repeated ? 1 : 0);
      engine = new Engine(factory);
      await engine.load(run.root);
    }
    await engine.resume(run.run_id);
    const resumed = await engine.snapshot(run.run_id);
    const node = resumed.nodes.deliver;
    assert.ok(node);
    assert.equal(workers, 1);
    assert.equal(node.attempt, 1);
    assert.equal(node.refutations, refuted ? 1 : 0);
    assert.equal(await readFile(resolve(project, "note.txt"), "utf8"), "External edit");
    assert.equal(
      await readFile(resolve(project, "neighbor.txt"), "utf8"),
      "Preserve neighboring file",
    );
    if (mode === "budget") {
      assert.equal(resumed.state, RunStatus.Blocked);
      assert.equal(reconciliations, 0);
      assert.equal(checks, 0);
      assert.equal(node.reconciliations, undefined);
      assert.deepEqual(node.phases[ExecutionPhase.Worker], received);
      return true;
    }
    assert.equal(resumed.state, refuted ? RunStatus.Failed : RunStatus.Passed);
    assert.equal(resumed.schema_version, RunFormat.Reconciliation);
    assert.equal(reconciliations, repeated ? 2 : 1);
    assert.equal(checks, 1);
    assert.deepEqual(node.reconciliations?.[0]?.phases[ExecutionPhase.Worker], received);
    if (!refuted) {
      assert.deepEqual(node.output, { reconciled: true });
      assert.deepEqual(node.changes, {});
    }
    const usage = await engine.usage(run.run_id);
    assert.equal(usage.executions, repeated ? 4 : 3);
    assert.equal(usage.known.input_tokens, repeated ? 19 : 12);
    assert.equal(usage.known.output_tokens, repeated ? 8 : 5);
    assert.equal(usage.known.cost_usd, repeated ? 0.05 : 0.03);
    const events = await engine.events(run.run_id);
    const numbers = await runNumbers(
      resumed,
      usage,
      (async function* () {
        yield* events.events;
      })(),
    );
    assert.equal(numbers.input_tokens.value, usage.known.input_tokens);
    assert.equal(numbers.output_tokens.value, usage.known.output_tokens);
    assert.equal(numbers.cost_usd.value, usage.known.cost_usd);
    if (refuted) return true;
    if (mode === "resume" || mode === "changed-input") {
      const journal = resolve(run.root, BoardFile.Journal);
      const lines = (await readFile(journal, "utf8")).trimEnd().split("\n");
      const generation = lines.findIndex(
        (line) =>
          RunEventSchema.parse(JSON.parse(line)).type === RunEventKind.ReconciliationStarted,
      );
      assert.ok(generation >= 0);
      await writeFile(journal, `${lines.slice(0, generation + 1).join("\n")}\n`);
      if (mode === "changed-input") {
        assert.ok(node.reconciliations?.[0]);
        await writeFile(resolve(node.reconciliations[0].input, "note.txt"), "Changed evidence");
      }
      engine = new Engine(factory);
      await engine.load(run.root);
      await engine.resume(run.run_id);
      assert.equal(
        (await engine.snapshot(run.run_id)).state,
        mode === "changed-input" ? RunStatus.Blocked : RunStatus.Passed,
      );
      assert.equal(workers, 1);
      assert.equal(reconciliations, mode === "changed-input" ? 1 : 2);
      assert.equal(checks, mode === "changed-input" ? 1 : 2);
      assert.equal((await engine.usage(run.run_id)).executions, mode === "changed-input" ? 1 : 3);
    }
    assert.ok(
      node.snapshot?.endsWith(
        `${RunFile.ReconciliationPrefix}${repeated ? 2 : 1}/${RunFile.Candidate}`,
      ),
    );
    return true;
  });
}

export async function reconciliationKnowledge(accepted: boolean, nested: boolean) {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    const project = resolve(root, nested ? "project/nested" : "project");
    const home = resolve(root, "home");
    await mkdir(project, { recursive: true });
    await writeFile(resolve(project, "note.txt"), "Original input");
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const plan = validateWorkflow({
      name: "Reconciliation knowledge",
      goal: "Publish only the checked generation knowledge",
      personas: {
        writer: { description: "Writer", role: "Write", tools: [AgentTool.Write] },
        checker: { description: "Checker", role: "Check" },
      },
      steps: [
        {
          id: "deliver",
          files: ["note.txt"],
          do: { persona: "writer", task: "Deliver once" },
          falsify: [{ persona: "checker", task: "Check reconciled result" }],
        },
      ],
    });
    const step = plan.nodes[0];
    assert.ok(step);
    const added: string[] = [];
    let run: Run;
    const factory = () =>
      new FakeBackend(async (spec, prompt) => {
        const state = run.nodes[step.id];
        assert.ok(state);
        const scope = runKnowledgeScope(run, step, state);
        if (!spec.writable) {
          for (const id of added)
            await assert.rejects(hub.get(id), { code: ErrorCode.KnowledgeMissing });
          return {
            json: {
              verdict: accepted ? Verdict.Survived : Verdict.Refuted,
              evidence: "Fresh checked knowledge",
            },
          };
        }
        const reconciling = Boolean(JSON.parse(prompt).reconciliation);
        assert.equal(
          scope.candidate_id,
          reconciling ? "worker-reconciliation-1" : ExecutionPhase.Worker,
        );
        assert.equal(await hub.attempts.read(scope), null);
        const entry = await hub
          .view(scope)
          .add({ private_revision: null, entry: knowledgeDraft(KnowledgeKind.Fact) });
        added.push(entry.entry.id);
        await writeFile(
          resolve(project, "note.txt"),
          reconciling ? "Reconciliation edit" : "Received edit",
        );
        if (!reconciling) await symlink("note.txt", resolve(project, "unsafe-link"));
        return { json: { received: true } };
      });
    const config = await resolveConfig({
      home,
      project,
      overrides: { defaults: { max_attempts: 1 } },
    });
    let engine = new Engine(factory, {}, { knowledge: hub.attempts });
    run = await engine.create({
      project,
      config,
      plan,
      backend: Backend.Fake,
      client_id: "reconciliation",
      submission_id: "knowledge",
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Blocked);
    const state = run.nodes[step.id];
    assert.ok(state);
    const originalScope = runKnowledgeScope(run, step, state);
    await rm(resolve(project, "unsafe-link"));
    await writeFile(resolve(project, "note.txt"), "External edit");
    engine = new Engine(factory, {}, { knowledge: hub.attempts });
    run = await engine.load(run.root);
    await engine.resume(run.run_id);
    assert.equal(run.state, accepted ? RunStatus.Passed : RunStatus.Failed);
    assert.equal(added.length, 2);
    assert.equal((await hub.attempts.read(originalScope))?.state, KnowledgeAttemptState.Open);
    await assert.rejects(hub.get(added[0] ?? ""), { code: ErrorCode.KnowledgeMissing });
    if (accepted) assert.equal((await hub.get(added[1] ?? "")).entry.kind, KnowledgeKind.Fact);
    else await assert.rejects(hub.get(added[1] ?? ""), { code: ErrorCode.KnowledgeMissing });
    assert.equal(
      await readFile(resolve(project, "note.txt"), "utf8"),
      accepted ? "Reconciliation edit" : "External edit",
    );
    return true;
  });
}

export function reconciliationRefusal(
  falsifier: boolean,
  decision: RequestDecision,
  changed: boolean,
) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    await writeFile(resolve(project, "note.txt"), "Original input");
    let workers = 0;
    let checks = 0;
    const factory = () =>
      new FakeBackend(async () => {
        workers++;
        await writeFile(resolve(project, "note.txt"), "Worker edit");
        return { json: { original: true } };
      });
    const scripts: ScriptCheck = async () => {
      checks++;
      await writeFile(resolve(project, "note.txt"), "External edit");
      return {
        exit_code: 1,
        stdout: Buffer.from("Refuted original work"),
        stderr: Buffer.alloc(0),
      };
    };
    const engine = new Engine(factory, {}, { scripts });
    const run = await engine.create({
      project,
      config: await resolveConfig({
        home: resolve(root, "home"),
        project,
        overrides: { defaults: { max_attempts: 1 } },
      }),
      backend: Backend.Fake,
      client_id: "retained-refutation",
      submission_id: "retained-refutation",
      plan: validateWorkflow({
        name: "Retained refutation",
        goal: "Keep the original refusal and approval boundary",
        personas: { writer: { description: "Writer", role: "Write", tools: [AgentTool.Write] } },
        steps: [
          {
            id: "deliver",
            files: ["note.txt"],
            do: { persona: "writer", task: "Deliver once" },
            checks: falsifier ? [] : ["refute"],
            falsify: [{ script: "refute" }],
          },
        ],
      }),
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Waiting);
    const original = structuredClone(run.nodes.deliver?.phases);
    const request = (await engine.requests.list(run.run_id))[0];
    assert.ok(request);
    await engine.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision,
        reason: "Preserve the external edit",
      },
      { client_id: run.client_id, authority: ApprovalLevel.Auto },
    );
    if (changed) await writeFile(resolve(project, "note.txt"), "Newest external edit");
    await engine.resume(run.run_id);
    assert.equal(
      run.state,
      changed
        ? RunStatus.Waiting
        : decision === RequestDecision.Approve
          ? RunStatus.Failed
          : RunStatus.Blocked,
    );
    assert.equal(workers, 1);
    assert.equal(checks, 1);
    assert.equal(run.nodes.deliver?.reconciliations, undefined);
    assert.deepEqual(run.nodes.deliver?.phases, original);
    assert.equal(
      await readFile(resolve(project, "note.txt"), "utf8"),
      changed ? "Newest external edit" : "External edit",
    );
    if (changed) assert.equal((await engine.requests.list(run.run_id)).length, 2);
    return true;
  });
}

export async function scriptReconciliation(mode: string, nested: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, nested ? "project/nested" : "project");
    const home = resolve(root, "home");
    await mkdir(project, { recursive: true });
    await writeFile(resolve(project, "note.txt"), "Original input");
    let commands = 0;
    let reconciliations = 0;
    let checks = 0;
    const scripts: ScriptCheck = async (command, cwd) => {
      assert.equal(command, "deliver once");
      assert.equal(cwd, project);
      commands++;
      await writeFile(resolve(project, "note.txt"), "Command edit");
      await symlink("note.txt", resolve(project, "unsafe-link"));
      return { exit_code: 0, stdout: Buffer.from("Original result"), stderr: Buffer.alloc(0) };
    };
    const original = { exit_code: 0, stdout: "Original result", stderr: "" };
    const factory = () =>
      new FakeBackend(async (spec, prompt) => {
        assert.equal(spec.cwd, project);
        const task = JSON.parse(prompt);
        if (!spec.writable) {
          checks++;
          assert.deepEqual(task.candidate, original);
          assert.equal(await readFile(resolve(project, "note.txt"), "utf8"), "Reconciled edit");
          return {
            json: {
              verdict: mode === "refuted" ? Verdict.Refuted : Verdict.Survived,
              evidence: "Checked reconciled files against original command result",
            },
          };
        }
        reconciliations++;
        assert.equal(spec.persona_id, "merger");
        assert.equal(
          task.task,
          `${RunnerMessage.ReconcileReceived}\nMerge the retained command edit`,
        );
        assert.equal(task.reconciliation.original_task, "deliver once");
        assert.deepEqual(task.reconciliation.original_result, original);
        assert.equal(
          await readFile(resolve(task.reconciliation.original_input, "note.txt"), "utf8"),
          "Original input",
        );
        assert.equal(
          await readFile(resolve(task.reconciliation.current_input, "note.txt"), "utf8"),
          "External edit",
        );
        await writeFile(resolve(project, "note.txt"), "Reconciled edit");
        return {
          json: { reconciled: true },
          usage: { input_tokens: 7, output_tokens: 3, cost_usd: 0.02 },
        };
      });
    const config = await resolveConfig({
      home,
      project,
      overrides: {
        defaults: { max_attempts: 1 },
        recovery: { max_retries: mode === "budget" ? 0 : 2 },
      },
    });
    let engine = new Engine(factory, {}, { scripts });
    const run = await engine.create({
      project,
      config,
      backend: Backend.Fake,
      client_id: "script-reconciliation",
      submission_id: mode,
      plan: validateWorkflow({
        name: "Script reconciliation",
        goal: "Reconcile files without repeating an external command",
        personas: {
          merger: {
            description: "Merger",
            role: "Merge received work",
            tools: [AgentTool.Read, AgentTool.Write],
          },
          skeptic: { description: "Checker", role: "Challenge reconciled files" },
        },
        steps: [
          {
            id: "deliver",
            files: ["note.txt"],
            do: { script: "deliver once" },
            ...(mode === "missing"
              ? {}
              : { reconcile: { persona: "merger", task: "Merge the retained command edit" } }),
            falsify: [{ persona: "skeptic", task: "Check the original result and current files" }],
          },
        ],
      }),
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Blocked);
    const receipt = structuredClone(run.nodes.deliver?.phases[ExecutionPhase.Worker]);
    assert.ok(receipt?.capture_pending);
    assert.deepEqual(receipt.answer, original);
    await rm(resolve(project, "unsafe-link"));
    await writeFile(resolve(project, "note.txt"), "External edit");
    engine = new Engine(factory, {}, { scripts });
    await engine.load(run.root);
    await engine.resume(run.run_id);
    const recovered = await engine.snapshot(run.run_id);
    const node = recovered.nodes.deliver;
    assert.ok(node);
    assert.equal(commands, 1);
    assert.equal(node.attempt, 1);
    if (mode === "missing" || mode === "budget") {
      assert.equal(recovered.state, RunStatus.Blocked);
      assert.equal(reconciliations, 0);
      assert.equal(checks, 0);
      assert.deepEqual(node.phases[ExecutionPhase.Worker], receipt);
      assert.equal(await readFile(resolve(project, "note.txt"), "utf8"), "External edit");
      return true;
    }
    assert.equal(recovered.state, mode === "refuted" ? RunStatus.Failed : RunStatus.Passed);
    assert.equal(reconciliations, 1);
    assert.equal(checks, 1);
    assert.deepEqual(node.reconciliations?.[0]?.phases[ExecutionPhase.Worker], receipt);
    assert.deepEqual(node.phases[ExecutionPhase.Worker]?.answer, { reconciled: true });
    if (mode !== "refuted") assert.deepEqual(node.output, original);
    assert.equal(
      await readFile(resolve(project, "note.txt"), "utf8"),
      mode === "refuted" ? "External edit" : "Reconciled edit",
    );
    const usage = await engine.usage(run.run_id);
    assert.equal(usage.known.input_tokens, 7);
    assert.equal(usage.known.output_tokens, 3);
    assert.equal(usage.known.cost_usd, 0.02);
    return true;
  });
}

export async function splitReconciliation(mode: string, nested: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, nested ? "project/nested" : "project");
    await mkdir(project, { recursive: true });
    await writeFile(resolve(project, "note.txt"), "Original input");
    let parts = 0;
    let reconciliations = 0;
    let checks = 0;
    const original = [{ part: 1 }, { part: 2 }];
    const factory = () =>
      new FakeBackend(async (spec, prompt) => {
        assert.equal(spec.cwd, project);
        const task = JSON.parse(prompt);
        if (spec.invocation_id.startsWith("source/"))
          return {
            json: spec.writable
              ? { parts: [1, 2] }
              : { verdict: Verdict.Survived, evidence: "Checked source" },
          };
        if (!spec.writable) {
          checks++;
          assert.deepEqual(task.candidate, original);
          assert.equal(await readFile(resolve(project, "note.txt"), "utf8"), "Reconciled edit");
          return {
            json: {
              verdict: mode === "refuted" ? Verdict.Refuted : Verdict.Survived,
              evidence: "Checked retained parts and current files",
            },
          };
        }
        if (task.reconciliation) {
          reconciliations++;
          assert.equal(spec.persona_id, "merger");
          assert.deepEqual(task.reconciliation.original_result, original);
          assert.equal(task.reconciliation.original_task, "Deliver each part once");
          assert.equal(
            await readFile(resolve(task.reconciliation.current_input, "note.txt"), "utf8"),
            "External edit",
          );
          await writeFile(resolve(project, "note.txt"), "Reconciled edit");
          return { json: { reconciled: true } };
        }
        parts++;
        await writeFile(resolve(project, "note.txt"), `Part ${parts}`);
        if (parts === 2) await symlink("note.txt", resolve(project, "unsafe-link"));
        return { json: { part: task.inputs.part } };
      });
    const config = await resolveConfig({
      home: resolve(root, "home"),
      project,
      overrides: {
        defaults: { max_attempts: 1 },
        recovery: { max_retries: mode === "budget" ? 0 : 2 },
      },
    });
    let engine = new Engine(factory);
    const run = await engine.create({
      project,
      config,
      backend: Backend.Fake,
      client_id: "split-reconciliation",
      submission_id: mode,
      plan: validateWorkflow({
        name: "Split reconciliation",
        goal: "Retain every received part without dispatching it again",
        personas: {
          writer: { description: "Writer", role: "Deliver parts", tools: [AgentTool.Write] },
          merger: { description: "Merger", role: "Merge retained edits", tools: [AgentTool.Write] },
          skeptic: { description: "Checker", role: "Challenge" },
        },
        steps: [
          {
            id: "source",
            do: { persona: "writer", task: "List parts" },
            falsify: [{ persona: "skeptic", task: "Check source" }],
          },
          {
            id: "deliver",
            files: ["note.txt"],
            do: { persona: "writer", task: "Deliver each part once" },
            split: { parts: "source.parts", width: 1 },
            ...(mode === "missing"
              ? {}
              : { reconcile: { persona: "merger", task: "Merge every retained part" } }),
            falsify: [{ persona: "skeptic", task: "Check retained parts" }],
          },
        ],
      }),
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Blocked);
    assert.equal(parts, 2);
    assert.equal((await engine.usage(run.run_id)).executions, 4);
    const receipt = structuredClone(run.nodes.deliver?.phases);
    assert.ok(receipt?.worker?.capture_pending);
    assert.deepEqual(receipt.worker.answer, original);
    await rm(resolve(project, "unsafe-link"));
    await writeFile(resolve(project, "note.txt"), "External edit");
    engine = new Engine(factory);
    await engine.load(run.root);
    await engine.resume(run.run_id);
    const recovered = await engine.snapshot(run.run_id);
    const node = recovered.nodes.deliver;
    assert.ok(node);
    assert.equal(parts, 2);
    assert.equal(node.attempt, 1);
    const usage = await engine.usage(run.run_id);
    assert.equal(usage.executions, mode === "missing" || mode === "budget" ? 4 : 6);
    const restored = new Engine(factory);
    await restored.load(run.root);
    assert.deepEqual(await restored.usage(run.run_id), usage);
    if (mode === "missing" || mode === "budget") {
      assert.equal(recovered.state, RunStatus.Blocked);
      assert.equal(reconciliations, 0);
      assert.equal(checks, 0);
      assert.deepEqual(node.phases, receipt);
      assert.equal(await readFile(resolve(project, "note.txt"), "utf8"), "External edit");
      return true;
    }
    assert.equal(recovered.state, mode === "refuted" ? RunStatus.Failed : RunStatus.Passed);
    assert.equal(reconciliations, 1);
    assert.equal(checks, 1);
    assert.deepEqual(node.reconciliations?.[0]?.phases, receipt);
    assert.deepEqual(node.phases.worker?.answer, { reconciled: true });
    if (mode !== "refuted") assert.deepEqual(node.output, original);
    assert.equal(
      await readFile(resolve(project, "note.txt"), "utf8"),
      mode === "refuted" ? "External edit" : "Reconciled edit",
    );
    return true;
  });
}
