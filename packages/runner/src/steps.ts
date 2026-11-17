import { relative, resolve } from "node:path";
import { atomicWrite, initialPhase } from "@titan/board";
import {
  ErrorCode,
  ExecutionPhase,
  type FailureKind,
  FileEncoding,
  ProofAnswer,
  ProofReportFormat,
  RunEventKind,
  RunFile,
  RunFormat,
  RunHubOutcome,
  ScriptExecution,
  SplitInput,
  StepStatus,
  TitanRelease,
  Verdict,
  VerifyKind,
  WorkflowField,
} from "@titan/constants";
import { hash, newId } from "@titan/core";
import { OperationalError, TitanError } from "@titan/errors";
import { liveCandidateConflict, RunnerMessage, stepReference } from "@titan/messages";
import type { RequestLedger } from "@titan/requests";
import {
  type CommandCapture,
  type FalsifierAnswer,
  FalsifierAnswerSchema,
  type FalsifyResult,
  type FileMap,
  type NodeState,
  type PhaseContext,
  RecordedScriptAnswerSchema,
  type Run,
  type RunCommit,
  type SavedCommandCapture,
  SavedCommandCaptureSchema,
  type ScriptCheck,
  ScriptProofRecordSchema,
  type Split,
  type Step,
} from "@titan/types";
import { personaAction } from "@titan/workflow";
import {
  createWorkspace,
  exists,
  fileIdentity,
  readTree,
  treeHash,
  writeTree,
} from "@titan/workspace";
import {
  assembleRun,
  currentCandidate,
  runParents,
  verifyAttemptInput,
  verifyCandidate,
} from "./artifacts.ts";
import type { Capacity } from "./capacity.ts";
import type { FileAccess } from "./file-access.ts";
import { reconcileFiles } from "./file-reconciliation.ts";
import { readRunSnapshot } from "./file-scope.ts";
import type { RunKnowledge } from "./knowledge.ts";
import { liveRun, readLiveWriteTree, scoped, verifyLiveCandidate, workPath } from "./live.ts";
import { recordPersonaQuality } from "./persona-quality.ts";
import type { AgentPhases } from "./phases.ts";
import { assertProofCheckers } from "./proof-checkers.ts";
import { assertCaptured, receiveWorker, restoreCaptured, sealWorker } from "./received.ts";
import {
  reconcileReceived,
  stepFolder,
  verifyReconciliation,
  workerAction,
} from "./reconciliation.ts";
import type { RunHubFlow } from "./run-hub-flow.ts";
import { loadScriptCapture, saveScriptCapture } from "./script-captures.ts";
import { scriptVerdict } from "./script-verdict.ts";
import { referenceValue, runParts, splitWidth } from "./split.ts";
import { withWriteInputs } from "./write-inputs.ts";
import { recordWrittenFiles } from "./written-files.ts";

export class RunSteps {
  constructor(
    private phases: AgentPhases,
    private knowledge: RunKnowledge,
    private hub: RunHubFlow,
    private commit: RunCommit,
    private capacity: Capacity,
    private requests: () => RequestLedger,
    private scripts?: ScriptCheck,
    private files?: FileAccess,
  ) {}
  private verifyInput(run: Run, step: Step, input: string, signal: AbortSignal): Promise<FileMap> {
    return this.capacity.use(
      run.run_id,
      signal,
      async () => withWriteInputs(run, step, await verifyAttemptInput(run, step, input)),
      {
        max_parallel: run.config.value.limits.max_parallel,
      },
    );
  }

  private async prepareReview(
    run: Run,
    step: Step,
    candidate: string,
    reviewFolder: string,
  ): Promise<void> {
    await verifyCandidate(run, step, candidate);
    if (liveRun(run)) return;
    if (!(await exists(reviewFolder)))
      await createWorkspace(
        run.project,
        reviewFolder,
        await readTree(candidate, run.config.value.limits),
        run.config.value.limits,
      );
  }

  private async prepare(run: Run, step: Step, state: NodeState, folder: string): Promise<void> {
    if (!state.input) {
      const limits = run.config.value.limits;
      const live = liveRun(run);
      const files = live
        ? scoped(run, step, await readLiveWriteTree(run, step))
        : await assembleRun(run, runParents(run, step));
      const input = resolve(folder, RunFile.Input);
      const work = workPath(run, state, folder);
      await writeTree(input, files, limits);
      if (!live) await createWorkspace(run.project, work, files, limits);
      state.input = input;
      state.work = work;
      await this.commit(run, RunEventKind.AttemptStarted, {
        step_id: step.id,
        attempt: state.attempt,
      });
    }
  }

  private async keepCandidate(
    run: Run,
    step: Step,
    state: NodeState,
    candidate: string,
    output: unknown,
    signal: AbortSignal,
  ): Promise<void> {
    const input = state.reconciliations?.at(-1)?.input ?? state.input;
    if (!input) throw new TitanError(ErrorCode.MissingWorkspace, step.id);
    await verifyReconciliation(run, step, state);
    const before = scoped(run, step, await this.verifyInput(run, step, input, signal));
    const everything = await readTree(candidate, run.config.value.limits);
    await verifyCandidate(run, step, candidate, everything);
    await verifyLiveCandidate(run, candidate, step);
    const after = scoped(run, step, everything);
    state.changes = {};
    for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (fileIdentity(before[path]) !== fileIdentity(after[path]))
        state.changes[path] = fileIdentity(after[path]) ?? null;
    }
    if (!(await this.knowledge.keep(run, step, state))) return;
    signal.throwIfAborted();
    if (liveRun(run)) await recordWrittenFiles(run.project, Object.keys(state.changes));
    state.snapshot = candidate;
    state.output = output;
    await this.hub.keep(run, step, state, this.owner(step), RunHubOutcome.Passed, []);
    signal.throwIfAborted();
    state.state = StepStatus.Passed;
    await this.commit(run, RunEventKind.StepPassed, {
      step_id: step.id,
      attempt: state.attempt,
    });
  }

  private owner(step: Step): string {
    return personaAction(step.do)?.persona ?? step.id;
  }

  private async script(
    context: PhaseContext,
    phase: string,
    script: string,
    cwd: string,
  ): Promise<CommandCapture> {
    if (!this.scripts)
      throw new OperationalError(ErrorCode.ScriptApprovalRequired, RunnerMessage.ScriptApproval);
    try {
      const cached = context.state.phases[phase];
      if (phase !== ExecutionPhase.Worker && cached?.completed) {
        return loadScriptCapture(context.run, cached.answer);
      }
      if (cached) assertCaptured(cached);
      const folder = stepFolder(context.run, context.step, context.state);
      const before =
        phase === ExecutionPhase.Worker
          ? undefined
          : await currentCandidate(context.run, context.step, folder);
      if (before) await verifyLiveCandidate(context.run, before, context.step);
      context.state.phases[phase] ??= initialPhase();
      const execution = {
        run_id: context.run.run_id,
        step_id: context.step.id,
        attempt: context.state.attempt,
        phase,
        execution_id: newId(),
      };
      const file_claim = await this.files?.bind(context.run, context.step, {
        step_id: execution.step_id,
        attempt: execution.attempt,
        phase: execution.phase,
        execution_id: execution.execution_id,
      });
      const started = Date.now();
      const result = await this.scripts(script, cwd, context.signal, {
        ...execution,
        ...(file_claim ? { file_claim } : {}),
      });
      if (phase === ExecutionPhase.Worker) return result;
      const checkpoint = initialPhase();
      checkpoint.execution_id = execution.execution_id;
      if (file_claim) checkpoint.file_claim = file_claim;
      checkpoint.capture_pending = true;
      checkpoint.answer =
        context.run.schema_version >= RunFormat.ProofCaptures
          ? await saveScriptCapture(
              context.run,
              stepFolder(context.run, context.step, context.state),
              execution.execution_id,
              result,
              Math.max(0, Date.now() - started),
            )
          : {
              exit_code: result.exit_code,
              stdout: result.stdout.toString(FileEncoding.Utf8),
              stderr: result.stderr.toString(FileEncoding.Utf8),
              stdout_base64: result.stdout.toString(FileEncoding.Base64),
              stderr_base64: result.stderr.toString(FileEncoding.Base64),
              elapsed_ms: Math.max(0, Date.now() - started),
            };
      context.state.phases[phase] = checkpoint;
      if (context.run.schema_version < RunFormat.ScriptCandidates)
        context.run.schema_version = RunFormat.ScriptCandidates;
      await this.commit(context.run, RunEventKind.PhaseReceived, {
        step_id: context.step.id,
        attempt: context.state.attempt,
        phase,
        execution_id: execution.execution_id,
      });
      if (
        before &&
        liveRun(context.run) &&
        (phase.startsWith(ScriptExecution.CheckPrefix) ||
          phase.startsWith(ScriptExecution.ProofPrefix))
      ) {
        checkpoint.answer = await this.retainScriptCandidate(
          context,
          folder,
          execution.execution_id,
          before,
          SavedCommandCaptureSchema.parse(checkpoint.answer),
        );
      }
      delete checkpoint.capture_pending;
      checkpoint.completed = true;
      await this.commit(context.run, RunEventKind.PhaseCompleted, {
        step_id: context.step.id,
        phase,
      });
      return result;
    } catch (error) {
      if (error instanceof TitanError && error.code === ErrorCode.RequestWaiting)
        context.state.state = StepStatus.Waiting;
      throw error;
    }
  }

  private async retainScriptCandidate(
    context: PhaseContext,
    folder: string,
    execution: string,
    before: string,
    answer: SavedCommandCapture,
  ): Promise<SavedCommandCapture> {
    const { run, step, state } = context;
    const limits = run.config.value.limits;
    const original = await readTree(before, limits);
    const current = await readRunSnapshot(run, run.project);
    const allowed = { ...scoped(run, step, original), ...scoped(run, step, current) };
    for (const path of new Set([...Object.keys(original), ...Object.keys(current)]))
      if (
        fileIdentity(original[path]) !== fileIdentity(current[path]) &&
        !Object.hasOwn(allowed, path)
      )
        throw new OperationalError(ErrorCode.FileConflict, liveCandidateConflict(path));
    const parent_hash = await treeHash(original);
    const checksum = await treeHash(current);
    if (parent_hash === checksum) return answer;
    const candidate = resolve(folder, execution, RunFile.Candidate);
    await writeTree(candidate, current, limits);
    if ((await treeHash(await readTree(candidate, limits))) !== checksum)
      throw new TitanError(ErrorCode.CheckpointChanged, step.id);
    await atomicWrite(resolve(folder, execution, RunFile.CandidateHash), checksum);
    const ordinal =
      Object.values(state.phases).filter(
        (phase) => SavedCommandCaptureSchema.safeParse(phase.answer).data?.candidate,
      ).length + 1;
    return {
      ...answer,
      candidate: { path: relative(run.root, candidate), hash: checksum, parent_hash, ordinal },
    };
  }

  private async falsify(context: PhaseContext, folder: string): Promise<FalsifyResult> {
    const { run, step, state, signal, inputs } = context;
    const refutations: string[] = [];
    const failures: FailureKind[] = [];
    for (const [index, falsifier] of step.falsify.entries()) {
      const candidate = await currentCandidate(run, step, folder);
      const reviewFolder = resolve(folder, `${RunFile.ReviewPrefix}${index}`);
      const cwd = liveRun(run) ? run.project : reviewFolder;
      if (WorkflowField.Script in falsifier) {
        await this.prepareReview(run, step, candidate, reviewFolder);
        const checked = scriptVerdict(
          await this.script(
            context,
            `${ExecutionPhase.FalsifierPrefix}${index}`,
            falsifier.script,
            cwd,
          ),
        );
        if (checked.verdict === Verdict.Refuted) refutations.push(checked.evidence);
        continue;
      }
      const verdict = await this.phases.execute(
        {
          run,
          step,
          state,
          key: `${ExecutionPhase.FalsifierPrefix}${index}`,
          action: falsifier,
          cwd,
          folder,
          inputs,
          candidate: context.candidate,
          signal,
        },
        async () => {
          await this.prepareReview(run, step, candidate, reviewFolder);
          await verifyLiveCandidate(run, candidate, step);
        },
      );
      const parsed = FalsifierAnswerSchema.safeParse(verdict);
      if (!parsed.success)
        throw new OperationalError(ErrorCode.CheckerProtocol, RunnerMessage.MissingVerdict);
      const answer = parsed.data;
      if (answer.verdict === Verdict.Refuted) {
        refutations.push(answer.evidence);
        if (answer.failure) failures.push(answer.failure);
      }
    }
    return { evidence: refutations, failures };
  }

  private async runChecks(context: PhaseContext, work: string): Promise<FalsifyResult> {
    const { run, step } = context;
    const evidence: string[] = [];
    const scripts = this.scripts;
    if (!scripts || !liveRun(run) || !step.checks.length) return { evidence, failures: [] };
    for (const [index, check] of step.checks.entries()) {
      const checked = scriptVerdict(
        await this.script(context, `${ScriptExecution.CheckPrefix}${index}`, check, work),
      );
      if (checked.verdict === Verdict.Refuted) evidence.push(checked.evidence);
    }
    return { evidence, failures: [] };
  }

  private async scriptProof(
    context: PhaseContext,
    index: number,
    command: string,
    work: string,
  ): Promise<FalsifierAnswer> {
    const key = `${ScriptExecution.ProofResultPrefix}${index}`;
    const cached = context.state.phases[key];
    if (cached?.completed) {
      const answer = RecordedScriptAnswerSchema.parse(cached.answer);
      return {
        verdict: answer.answer === ProofAnswer.Proven ? Verdict.Survived : Verdict.Refuted,
        evidence: answer.evidence,
      };
    }
    const phase = `${ScriptExecution.ProofPrefix}${index}${ScriptExecution.ProofSeparator}`;
    const first = scriptVerdict(
      await this.script(context, `${phase}${ScriptExecution.ProofFirst}`, command, work),
    );
    const second =
      context.state.attempt === 1
        ? scriptVerdict(
            await this.script(context, `${phase}${ScriptExecution.ProofRepeat}`, command, work),
          )
        : first;
    const verdict = first.verdict === second.verdict ? first.verdict : Verdict.Refuted;
    const evidence =
      first.verdict === second.verdict ? first.evidence : RunnerMessage.ScriptDiffers;
    const answer = {
      answer: verdict === Verdict.Survived ? ProofAnswer.Proven : ProofAnswer.NotProven,
      evidence,
    };
    const captures = [ScriptExecution.ProofFirst, ScriptExecution.ProofRepeat]
      .map((ordinal) => context.state.phases[`${phase}${ordinal}`])
      .filter((saved) => saved?.completed)
      .map((saved) => SavedCommandCaptureSchema.parse(saved?.answer));
    const output = JSON.stringify({ command, captures });
    const path = resolve(
      stepFolder(context.run, context.step, context.state),
      key + ScriptExecution.ProofOutputSuffix,
    );
    await atomicWrite(path, output);
    const result_hash = await treeHash(
      await readTree(
        await currentCandidate(
          context.run,
          context.step,
          stepFolder(context.run, context.step, context.state),
        ),
        context.run.config.value.limits,
      ),
    );
    const candidate_id = hash(
      JSON.stringify([context.run.run_id, context.step.id, context.state.attempt, result_hash]),
    );
    const report = ScriptProofRecordSchema.parse({
      check_id: hash(JSON.stringify([candidate_id, index, hash(command)])),
      scope: ProofReportFormat.Step,
      kind: VerifyKind.Script,
      step_id: context.step.id,
      part: null,
      candidate: ProofReportFormat.Candidate,
      candidate_id,
      attempt: context.state.attempt,
      phase: key,
      result_hash,
      statement_hash: null,
      command_hash: hash(command),
      checker: VerifyKind.Script,
      checker_version: context.run.runtime_version ?? TitanRelease,
      answer: answer.answer,
      elapsed_ms: captures.reduce((sum, capture) => sum + (capture.elapsed_ms ?? 0), 0),
      output: relative(context.run.root, path),
      output_hash: hash(output),
    });
    context.state.phases[key] = {
      ...initialPhase(),
      completed: true,
      answer: { ...answer, report },
    };
    await this.commit(context.run, RunEventKind.CheckAnswered, {
      step_id: context.step.id,
      phase: key,
      attempt: context.state.attempt,
      ...answer,
      report,
    });
    return { verdict, evidence };
  }

  private async runProofs(context: PhaseContext, work: string): Promise<FalsifyResult> {
    const evidence: string[] = [];
    const checks = context.step.verify.filter((entry) => entry.kind === VerifyKind.Script);
    for (const [index, entry] of checks.entries()) {
      const checked = await this.scriptProof(context, index, entry.run, work);
      if (checked.verdict === Verdict.Refuted) evidence.push(checked.evidence);
    }
    return { evidence, failures: [] };
  }

  private reference(run: Run, step: Step, reference: string): unknown {
    const value = referenceValue(run, reference);
    if (value === undefined)
      throw new TitanError(ErrorCode.MissingOutput, stepReference(step.id, reference));
    return value;
  }

  private inputs(run: Run, step: Step): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    for (const [key, reference] of Object.entries(step.inputs))
      inputs[key] = this.reference(run, step, reference);
    return inputs;
  }

  private async parts(context: PhaseContext, folder: string, split: Split): Promise<unknown> {
    const { run, step, state, signal } = context;
    const work = workPath(run, state, folder);
    const done = state.phases[ExecutionPhase.Worker] ?? initialPhase();
    state.phases[ExecutionPhase.Worker] = done;
    if (done.completed) return done.answer;
    assertCaptured(done);
    const items = this.reference(run, step, split.parts);
    if (!Array.isArray(items))
      throw new OperationalError(ErrorCode.MissingOutput, RunnerMessage.SplitNotList);
    const limits = run.config.value.limits;
    const results = await runParts(items, splitWidth(step, limits.max_parallel), (item, index) =>
      this.phases.execute({
        ...context,
        key: `${ExecutionPhase.PartPrefix}${index}`,
        inputs: Object.assign({}, context.inputs, {
          [SplitInput.Part]: item,
          [SplitInput.Index]: index,
        }),
        cwd: work,
        signal,
      }),
    );
    await receiveWorker(context, results, this.commit);
    const candidate = resolve(folder, RunFile.Candidate);
    await writeTree(candidate, await readRunSnapshot(run, work), limits);
    const checksum = await treeHash(await readTree(candidate, limits));
    await atomicWrite(resolve(folder, RunFile.CandidateHash), checksum);
    const phase = state.phases[ExecutionPhase.Worker] ?? initialPhase();
    await sealWorker(context, phase, checksum, this.commit);
    phase.answer = results;
    delete phase.capture_pending;
    phase.completed = true;
    state.phases[ExecutionPhase.Worker] = phase;
    await this.commit(run, RunEventKind.PhaseCompleted, {
      step_id: step.id,
      phase: ExecutionPhase.Worker,
      execution_id: newId(),
    });
    return results;
  }

  private async work(context: PhaseContext, folder: string): Promise<unknown> {
    const { run, step, state } = context;
    if (await restoreCaptured(context, resolve(folder, RunFile.Candidate), this.commit))
      return state.phases[ExecutionPhase.Worker]?.answer;
    if (state.reconciliations && step.reconcile)
      return this.phases.execute(context, () => this.prepare(run, step, state, folder));
    if (WorkflowField.Script in step.do) {
      await this.prepare(run, step, state, folder);
      return this.scriptWork(context, folder, step.do.script);
    }
    if (!step.split)
      return this.phases.execute(context, () => this.prepare(run, step, state, folder));
    await this.prepare(run, step, state, folder);
    return this.parts(context, folder, step.split);
  }

  private async scriptWork(
    context: PhaseContext,
    folder: string,
    command: string,
  ): Promise<unknown> {
    const { run, state, signal } = context;
    const phase = state.phases[ExecutionPhase.Worker] ?? initialPhase();
    state.phases[ExecutionPhase.Worker] = phase;
    if (phase.completed) return phase.answer;
    assertCaptured(phase);
    const capture = await this.script(
      context,
      ExecutionPhase.Worker,
      command,
      workPath(run, state, folder),
    );
    signal.throwIfAborted();
    if (capture.exit_code !== 0)
      throw new OperationalError(ErrorCode.ExecutionInterrupted, scriptVerdict(capture).evidence);
    await receiveWorker(
      context,
      {
        exit_code: capture.exit_code,
        stdout: capture.stdout.toString(FileEncoding.Utf8),
        stderr: capture.stderr.toString(FileEncoding.Utf8),
      },
      this.commit,
    );
    const candidate = resolve(folder, RunFile.Candidate);
    const limits = run.config.value.limits;
    await writeTree(candidate, await readRunSnapshot(run, workPath(run, state, folder)), limits);
    const checksum = await treeHash(await readTree(candidate, limits));
    await atomicWrite(resolve(folder, RunFile.CandidateHash), checksum);
    await sealWorker(context, phase, checksum, this.commit);
    delete phase.capture_pending;
    phase.completed = true;
    state.phases[ExecutionPhase.Worker] = phase;
    await this.commit(run, RunEventKind.PhaseCompleted, {
      step_id: context.step.id,
      phase: ExecutionPhase.Worker,
    });
    return phase.answer;
  }

  private async attempt(
    run: Run,
    step: Step,
    state: NodeState,
    signal: AbortSignal,
    max: number,
  ): Promise<boolean> {
    signal.throwIfAborted();
    if (state.input) await this.verifyInput(run, step, state.input, signal);
    await verifyReconciliation(run, step, state);
    if (await reconcileReceived(run, step, state, this.commit)) return false;
    const folder = stepFolder(run, step, state);
    const inputs = this.inputs(run, step);
    const result = await this.work(
      {
        run,
        step,
        state,
        key: ExecutionPhase.Worker,
        action: workerAction(step, state),
        cwd: workPath(run, state, folder),
        folder,
        inputs,
        candidate: null,
        signal,
      },
      folder,
    );
    const retained = state.reconciliations?.[0]?.phases[ExecutionPhase.Worker]?.answer;
    let worker = result;
    if (step.split && state.reconciliations) worker = retained;
    if (WorkflowField.Script in step.do && state.reconciliations)
      worker = SavedCommandCaptureSchema.parse(retained);
    if (!state.work || !state.input) throw new TitanError(ErrorCode.MissingWorkspace, step.id);
    let candidate = await currentCandidate(run, step, folder);
    if (state.read_paths) await verifyLiveCandidate(run, candidate, step);
    if (await this.files?.reviseReads(run, step)) return false;
    const checking = {
      run,
      step,
      state,
      key: ExecutionPhase.Worker,
      action: step.do,
      cwd: state.work,
      inputs,
      candidate: worker,
      signal,
    };
    const checked = await this.runChecks(checking, state.work);
    const proved = checked.evidence.length ? checked : await this.runProofs(checking, state.work);
    candidate = await currentCandidate(run, step, folder);
    const falsified = proved.evidence.length ? proved : await this.falsify(checking, folder);
    if (await this.files?.reviseReads(run, step)) return false;
    signal.throwIfAborted();
    await recordPersonaQuality(run, step, state, falsified.evidence.length > 0, this.commit);
    if (!falsified.evidence.length) {
      await this.keepCandidate(run, step, state, candidate, worker, signal);
      return true;
    }
    await this.knowledge.discard(run, step, state);
    if (liveRun(run)) await reconcileFiles(run, step, state, candidate, this.requests());
    state.evidence.push(...falsified.evidence);
    await this.hub.keep(
      run,
      step,
      state,
      this.owner(step),
      RunHubOutcome.Refuted,
      falsified.evidence,
    );
    state.failures = [...(state.failures ?? []), ...falsified.failures];
    state.refutations++;
    if (state.attempt === max) {
      state.state = StepStatus.Failed;
      await this.commit(run, RunEventKind.StepFailed, { step_id: step.id });
      return true;
    }
    state.attempt++;
    state.input = null;
    state.work = null;
    state.phases = {};
    delete state.read_paths;
    delete state.write_paths;
    delete state.write_inputs;
    delete state.reconciliations;
    await this.commit(run, RunEventKind.ResultRefuted, {
      step_id: step.id,
      attempt: state.attempt,
    });
    return false;
  }

  async execute(run: Run, step: Step, state: NodeState, signal: AbortSignal): Promise<void> {
    assertProofCheckers([...step.verify, ...(run.plan.workflow.verify ?? [])]);
    const max = step.max_attempts ?? run.config.value.defaults.max_attempts;
    while (state.attempt <= max) {
      const work = async () => {
        try {
          return await this.attempt(run, step, state, signal, max);
        } catch (error) {
          if (error instanceof OperationalError && error.code === ErrorCode.FileScopeChanged)
            return false;
          throw error;
        }
      };
      const done = this.files ? await this.files.use(run, step, signal, work) : await work();
      if (done) return;
    }
  }
}
