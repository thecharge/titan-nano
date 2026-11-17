import { relative, resolve } from "node:path";
import { atomicWrite, initialNode, initialPhase } from "@titan/board";
import {
  ErrorCode,
  FileEncoding,
  GoalExecution,
  ProofAnswer,
  ProofReportFormat,
  RunEventKind,
  RunFormat,
  ScriptExecution,
  StepStatus,
  TextSymbol,
  TitanRelease,
  Verdict,
  VerifyKind,
} from "@titan/constants";
import { hash, newId } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import {
  type GoalState,
  RecordedScriptAnswerSchema,
  type Run,
  type RunCommit,
  SavedCommandCaptureSchema,
  type ScriptCheck,
  ScriptProofRecordSchema,
  type Step,
} from "@titan/types";
import { readTree, treeHash } from "@titan/workspace";
import type { FileAccess } from "./file-access.ts";
import { readRunSnapshot } from "./file-scope.ts";
import { liveRun } from "./live.ts";
import { assertProofCheckers } from "./proof-checkers.ts";
import { loadScriptCapture, saveScriptCapture } from "./script-captures.ts";
import { scriptVerdict } from "./script-verdict.ts";

export class GoalChecks {
  constructor(
    private commit: RunCommit,
    private files: FileAccess,
    private scripts?: ScriptCheck,
  ) {}

  private async unchanged(run: Run, state: GoalState): Promise<void> {
    const root = state.work ?? run.project;
    const files = liveRun(run)
      ? await readRunSnapshot(run, root)
      : await readTree(root, run.config.value.limits);
    if ((await treeHash(files)) !== state.result_hash)
      throw new OperationalError(ErrorCode.FileConflict, RunnerMessage.GoalChanged);
  }

  private async capture(
    run: Run,
    step: Step,
    state: GoalState,
    phase: string,
    command: string,
    signal: AbortSignal,
  ) {
    await this.unchanged(run, state);
    signal.throwIfAborted();
    const saved = state.phases[phase];
    if (saved?.completed) {
      return scriptVerdict(await loadScriptCapture(run, saved.answer));
    }
    if (!this.scripts)
      throw new OperationalError(ErrorCode.ScriptApprovalRequired, RunnerMessage.ScriptApproval);
    state.phases[phase] ??= initialPhase();
    const execution = {
      run_id: run.run_id,
      step_id: GoalExecution.Id,
      attempt: GoalExecution.Attempt,
      phase,
      execution_id: newId(),
    };
    const file_claim = await this.files.bind(run, step, {
      step_id: execution.step_id,
      attempt: execution.attempt,
      phase: execution.phase,
      execution_id: execution.execution_id,
    });
    const started = Date.now();
    const capture = await this.scripts(command, state.work ?? run.project, signal, {
      ...execution,
      ...(file_claim ? { file_claim } : {}),
    });
    await this.unchanged(run, state);
    signal.throwIfAborted();
    const checkpoint = initialPhase();
    checkpoint.execution_id = execution.execution_id;
    if (file_claim) checkpoint.file_claim = file_claim;
    checkpoint.completed = true;
    checkpoint.answer =
      run.schema_version >= RunFormat.ProofCaptures
        ? await saveScriptCapture(
            run,
            resolve(run.root, GoalExecution.Directory),
            execution.execution_id,
            capture,
            Math.max(0, Date.now() - started),
          )
        : {
            exit_code: capture.exit_code,
            stdout: capture.stdout.toString(FileEncoding.Utf8),
            stderr: capture.stderr.toString(FileEncoding.Utf8),
            stdout_base64: capture.stdout.toString(FileEncoding.Base64),
            stderr_base64: capture.stderr.toString(FileEncoding.Base64),
            elapsed_ms: Math.max(0, Date.now() - started),
          };
    state.phases[phase] = checkpoint;
    await this.commit(run, RunEventKind.PhaseCompleted, { scope: ProofReportFormat.Goal, phase });
    return scriptVerdict(capture);
  }

  private async check(
    run: Run,
    step: Step,
    state: GoalState,
    index: number,
    command: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    const key = `${ScriptExecution.ProofResultPrefix}${index}`;
    const saved = state.phases[key];
    if (saved?.completed)
      return RecordedScriptAnswerSchema.parse(saved.answer).answer === ProofAnswer.Proven;
    const prefix = `${ScriptExecution.ProofPrefix}${index}${ScriptExecution.ProofSeparator}`;
    const first = await this.capture(
      run,
      step,
      state,
      prefix + ScriptExecution.ProofFirst,
      command,
      signal,
    );
    const second = await this.capture(
      run,
      step,
      state,
      prefix + ScriptExecution.ProofRepeat,
      command,
      signal,
    );
    const proven = first.verdict === Verdict.Survived && second.verdict === Verdict.Survived;
    const answer = {
      answer: proven ? ProofAnswer.Proven : ProofAnswer.NotProven,
      evidence: first.verdict === second.verdict ? first.evidence : RunnerMessage.ScriptDiffers,
    };
    const captures = [ScriptExecution.ProofFirst, ScriptExecution.ProofRepeat].map((ordinal) =>
      SavedCommandCaptureSchema.parse(state.phases[prefix + ordinal]?.answer),
    );
    const output = JSON.stringify({ command, captures });
    const path = resolve(
      run.root,
      GoalExecution.Directory,
      key + ScriptExecution.ProofOutputSuffix,
    );
    await atomicWrite(path, output);
    const candidate_id = hash(
      JSON.stringify([run.run_id, ProofReportFormat.Goal, state.result_hash]),
    );
    const report = ScriptProofRecordSchema.parse({
      check_id: hash(JSON.stringify([candidate_id, index, hash(command)])),
      scope: ProofReportFormat.Goal,
      kind: VerifyKind.Script,
      candidate: ProofReportFormat.Candidate,
      candidate_id,
      phase: key,
      result_hash: state.result_hash,
      statement_hash: null,
      command_hash: hash(command),
      checker: VerifyKind.Script,
      checker_version: run.runtime_version ?? TitanRelease,
      answer: answer.answer,
      elapsed_ms: captures.reduce((total, capture) => total + (capture.elapsed_ms ?? 0), 0),
      output: relative(run.root, path),
      output_hash: hash(output),
    });
    state.phases[key] = { ...initialPhase(), completed: true, answer: { ...answer, report } };
    await this.commit(run, RunEventKind.CheckAnswered, {
      scope: ProofReportFormat.Goal,
      ...answer,
      report,
    });
    return proven;
  }

  async execute(run: Run, result_hash: string, signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted();
    const verify = run.plan.workflow.verify ?? [];
    assertProofCheckers(verify);
    if (verify.length === 0) return true;
    if (run.goal && run.goal.result_hash !== result_hash)
      throw new OperationalError(ErrorCode.FileConflict, RunnerMessage.GoalChanged);
    run.goal ??= { ...initialNode(), result_hash };
    const state = run.goal;
    state.work = liveRun(run) ? run.project : run.artifacts;
    state.state = StepStatus.Running;
    const step: Step = {
      id: GoalExecution.Id,
      do: { script: TextSymbol.Empty },
      verify,
      inputs: {},
      checks: [],
      falsify: [],
    };
    await this.commit(run, RunEventKind.GoalStarted, { result_hash });
    return this.files.use(run, step, signal, async () => {
      await this.unchanged(run, state);
      let passed = true;
      for (const [index, check] of verify.entries()) {
        if (check.kind !== VerifyKind.Script) continue;
        if (!(await this.check(run, step, state, index, check.run, signal))) passed = false;
      }
      await this.unchanged(run, state);
      signal.throwIfAborted();
      state.state = passed ? StepStatus.Passed : StepStatus.Failed;
      await this.commit(run, RunEventKind.GoalCompleted, { result_hash, passed });
      return passed;
    });
  }
}
