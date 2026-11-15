import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectArtifacts } from "@titan/artifacts";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  FileEncoding,
  GoalExecution,
  ProofAnswer,
  RequestDecision,
  RunArtifactFile,
  RunEventKind,
  RunFormat,
  RunStatus,
  StepStatus,
} from "@titan/constants";
import { hash } from "@titan/core";
import { Engine } from "@titan/runner";
import { scopedScripts } from "@titan/server";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { SavedCommandCaptureSchema, ScriptProofReportSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function goalScriptChecks(first: number, second: number, mode: string) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    await writeFile(resolve(project, "note.txt"), "retained");
    let proofs = 0;
    let starts = 0;
    const create = (): Engine =>
      new Engine(
        () => new FakeBackend(),
        {},
        {
          scripts: scopedScripts(() => engine, 1, 1, {
            spawn(command) {
              starts++;
              const proof = command.at(-1) === "printf goal";
              const code = proof ? (proofs++ === 0 ? first : second) : 0;
              return {
                pid: 1,
                stdout: new Blob(["checked"]).stream(),
                stderr: new Blob([]).stream(),
                exited: Promise.resolve(code),
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
      project,
      config: await resolveConfig({ home, project }),
      plan: validateWorkflow({
        name: "Final goal verification",
        goal: "Publish only after checking the assembled result",
        personas: {},
        verify: [{ kind: "script", run: "printf goal", deterministic: true, timeout_s: 1 }],
        steps: [
          {
            id: "deliver",
            do: { script: "printf worker" },
            falsify: [{ script: "printf review" }],
            verify:
              mode === "mixed"
                ? [0, 1, 2].map((index) => ({
                    kind: "script",
                    run: `printf step-proof-${index}`,
                    deterministic: true,
                  }))
                : [],
          },
        ],
      }),
      backend: Backend.Fake,
      client_id: "goal-owner",
      submission_id: "goal-run",
    });
    if (mode.startsWith("legacy-")) run.schema_version = RunFormat.GoalProofs;
    await engine.start(run.run_id);
    let round = 0;
    while (engine.get(run.run_id).state === RunStatus.Waiting && round++ < 16) {
      const current = engine.get(run.run_id);
      const pending = (await engine.requests.list(run.run_id)).find(
        (request) => request.answer === null,
      );
      assert(pending);
      if (pending.scope.resource === GoalExecution.Id) {
        assert.equal(current.nodes.deliver?.state, StepStatus.Passed);
        assert.equal(current.goal?.state, StepStatus.Waiting);
        if (mode === "changed") {
          await writeFile(resolve(project, "note.txt"), "external change");
          await engine.resume(run.run_id);
          assert.equal(engine.get(run.run_id).state, RunStatus.Blocked);
          assert.equal(proofs, 0);
          assert.equal(
            await readFile(resolve(project, "note.txt"), FileEncoding.Utf8),
            "external change",
          );
          return true;
        }
        if (proofs > 0 && (mode === "restart" || mode.startsWith("legacy-"))) {
          if (mode === "legacy-text") {
            const phase = Object.values(current.goal?.phases ?? {}).find(
              (phase) => phase.completed,
            );
            assert(phase);
            const answer = SavedCommandCaptureSchema.parse(phase.answer);
            delete answer.stdout_base64;
            delete answer.stderr_base64;
            phase.answer = answer;
            await new RunStore(run.root).commit(current, RunEventKind.PhaseCompleted);
          }
          engine = create();
          await engine.load(run.root);
        }
        if (proofs > 0 && mode.startsWith("capture-")) {
          const phase = Object.values(current.goal?.phases ?? {}).find((phase) => phase.completed);
          assert(phase);
          const answer = SavedCommandCaptureSchema.parse(phase.answer);
          assert(answer.capture);
          const path = resolve(run.root, answer.capture.path);
          const retained = SavedCommandCaptureSchema.parse(
            JSON.parse(await readFile(path, FileEncoding.Utf8)),
          );
          if (mode === "capture-nested") retained.capture = answer.capture;
          else retained.exit_code = 1;
          const bytes = JSON.stringify(retained);
          await writeFile(path, bytes);
          answer.capture.hash = hash(bytes);
          phase.answer = answer;
          await new RunStore(run.root).commit(current, RunEventKind.PhaseCompleted);
          await engine.resume(run.run_id);
          assert.equal(engine.get(run.run_id).state, RunStatus.Blocked);
          assert.equal(proofs, 1);
          return true;
        }
      }
      await engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: pending.request_id,
          version: pending.version,
          decision:
            mode === "denied" && pending.scope.resource === GoalExecution.Id
              ? RequestDecision.Deny
              : RequestDecision.Approve,
          reason: "Reviewed exact command",
        },
        { client_id: "owner", authority: ApprovalLevel.Human },
      );
      await engine.resume(run.run_id);
    }
    const finished = engine.get(run.run_id);
    assert.equal(
      finished.schema_version,
      mode.startsWith("legacy-") ? RunFormat.GoalProofs : RunFormat.ProofCaptures,
    );
    if (mode.startsWith("corrupt-")) {
      const invalid = structuredClone(finished);
      assert(invalid.goal);
      if (mode === "corrupt-format") invalid.schema_version = RunFormat.ProofReports;
      else invalid.goal.work = resolve(root, "outside");
      await assert.rejects(async () =>
        new RunStore(run.root).commit(invalid, RunEventKind.GoalCompleted),
      );
      return true;
    }
    assert.equal(Object.keys(finished.nodes).length, 1);
    assert.equal(finished.nodes.deliver?.state, StepStatus.Passed);
    assert.equal((await engine.usage(run.run_id)).executions, 0);
    if (mode === "denied") {
      assert.equal(finished.state, RunStatus.Blocked);
      assert.equal(proofs, 0);
      return true;
    }
    assert.equal(
      proofs,
      2,
      JSON.stringify({
        state: finished.state,
        error: finished.error,
        events: (await engine.events(run.run_id)).events.slice(-4),
      }),
    );
    const kept = mode === "mixed" ? 3 : 0;
    assert.equal(starts, 4 + kept * 2);
    const passed = first === 0 && second === 0;
    assert.equal(finished.state, passed ? RunStatus.Passed : RunStatus.Failed);
    const report = ScriptProofReportSchema.parse(
      JSON.parse(await readFile(resolve(run.root, RunArtifactFile.Proofs), FileEncoding.Utf8)),
    );
    assert.equal(report.checks.length, 1 + kept);
    assert.equal(report.summary.total, 1 + kept);
    assert.equal(report.summary.proven, kept + (passed ? 1 : 0));
    assert.equal(report.summary.not_proven, passed ? 0 : 1);
    assert.equal(report.discarded_attempts.total, 0);
    const goal = report.checks.find((check) => check.scope === "goal");
    assert(goal);
    assert.equal(goal.scope, "goal");
    assert.equal(Object.hasOwn(goal, "step_id"), false);
    assert.equal(Object.hasOwn(goal, "attempt"), false);
    assert.equal(goal.answer, passed ? ProofAnswer.Proven : ProofAnswer.NotProven);
    const result = await readFile(resolve(run.root, RunArtifactFile.Result), FileEncoding.Utf8);
    assert(result.includes(`proven ${kept + (passed ? 1 : 0)} of ${kept + 1}`));
    const events = (await engine.events(run.run_id)).events;
    assert.equal(
      events.filter((event) => event.type === RunEventKind.CheckAnswered).length,
      1 + kept,
    );
    if (passed) await inspectArtifacts(finished);
    else await assert.rejects(inspectArtifacts(finished));
    return true;
  });
}
