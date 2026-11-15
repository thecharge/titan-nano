import { resolve } from "node:path";
import { executionNode } from "@titan/board";
import { createSecretScanner } from "@titan/config";
import {
  ErrorCode,
  ExecutionPhase,
  GoalExecution,
  RequestKind,
  RunEventKind,
  RunFile,
  RunStatus,
  ScriptExecution as Script,
  TextSymbol,
  VerifyKind,
  WorkflowField,
  WorkspaceModeSetting,
} from "@titan/constants";
import { hash } from "@titan/core";
import { OperationalError, TitanError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import { captureCommand, ownedCommandProcesses } from "@titan/process";
import { Capacity, type Engine } from "@titan/runner";
import {
  type CommandProcessPort,
  type ScriptCheck,
  type ScriptExecution,
  ScriptExecutionSchema,
  type Step,
} from "@titan/types";

function authorized(engine: Engine, execution: ScriptExecution, script: string, cwd: string) {
  const run = engine.get(execution.run_id);
  const step: Step | undefined =
    execution.step_id === GoalExecution.Id
      ? {
          id: GoalExecution.Id,
          do: { script: TextSymbol.Empty },
          verify: run.plan.workflow.verify ?? [],
          checks: [],
          falsify: [],
          inputs: {},
        }
      : run.plan.nodes.find((entry) => entry.id === execution.step_id);
  const state = executionNode(run, execution.step_id);
  if (
    !step ||
    !state?.work ||
    state.attempt !== execution.attempt ||
    (run.state !== RunStatus.Running && run.state !== RunStatus.Recovering)
  )
    throw new TitanError(ErrorCode.PermissionDenied, RunnerMessage.ScriptApproval);
  const phase = execution.phase;
  let command: string | undefined;
  let timeout_ms: number | undefined;
  let directory = state.work;
  if (phase === ExecutionPhase.Worker && WorkflowField.Script in step.do) command = step.do.script;
  if (phase.startsWith(Script.CheckPrefix))
    command = step.checks[Number(phase.slice(Script.CheckPrefix.length))];
  if (phase.startsWith(Script.ProofPrefix)) {
    const index = Number(phase.slice(Script.ProofPrefix.length).split(Script.ProofSeparator)[0]);
    const proof = step.verify[index];
    command = proof?.kind === VerifyKind.Script ? proof.run : undefined;
    if (proof?.kind === VerifyKind.Script)
      timeout_ms = Math.ceil(
        (proof.timeout_s ?? Script.ProofTimeoutSeconds) * Script.MillisecondsPerSecond,
      );
  }
  if (phase.startsWith(ExecutionPhase.FalsifierPrefix)) {
    const index = Number(phase.slice(ExecutionPhase.FalsifierPrefix.length));
    const action = step.falsify[index];
    command = action && WorkflowField.Script in action ? action.script : undefined;
    directory =
      (run.config.value.workspace?.mode ?? WorkspaceModeSetting.Live) === WorkspaceModeSetting.Live
        ? run.project
        : resolve(
            run.root,
            RunFile.Steps,
            step.id,
            `${RunFile.AttemptPrefix}${state.attempt}`,
            `${RunFile.ReviewPrefix}${index}`,
          );
  }
  if (command !== script || resolve(cwd) !== resolve(directory))
    throw new TitanError(ErrorCode.PermissionDenied, RunnerMessage.ScriptApproval);
  engine.validateFileExecution(execution);
  return { run, timeout_ms };
}

export function scopedScripts(
  owner: () => Engine,
  active: number,
  pending: number,
  processes: CommandProcessPort = ownedCommandProcesses,
): ScriptCheck {
  const capacity = new Capacity(active, pending);
  return async (script, cwd, signal, input) => {
    const parsed = ScriptExecutionSchema.safeParse(input);
    if (!parsed.success)
      throw new TitanError(ErrorCode.PermissionDenied, RunnerMessage.ScriptApproval);
    const execution = parsed.data;
    const engine = owner();
    const { run, timeout_ms } = authorized(engine, execution, script, cwd);
    const scope = {
      operation: Script.Operation,
      resource: execution.step_id,
      content_hashes: { command: hash(script), config: run.config.hash },
      arguments: [script, resolve(cwd), execution.phase, String(execution.attempt)],
      environment_names: [],
    };
    const id = Script.RequestPrefix + hash(JSON.stringify(scope));
    const ledger = engine.requests;
    const request =
      (await ledger.list(run.run_id)).find((entry) => entry.request_id === id) ??
      (await ledger.open(run.run_id, {
        request_id: id,
        kind: RequestKind.Action,
        scope,
        origin: { client_id: run.client_id, harness_session_id: null },
        expires_at: Date.now() + Script.ExpiresMs,
      }));
    if (request.answer === null)
      throw new OperationalError(ErrorCode.RequestWaiting, RunnerMessage.ScriptApproval);
    return capacity.use(
      run.run_id,
      signal,
      async () => {
        authorized(engine, execution, script, cwd);
        await ledger.approved(run.run_id, id, RequestKind.Action, scope);
        signal.throwIfAborted();
        await engine.recordScript(execution, RunEventKind.ScriptStarted, { request_id: id });
        const result = await captureCommand(
          [...Script.Shell, script],
          cwd,
          { timeout_ms },
          signal,
          processes,
        );
        const scanner = createSecretScanner();
        scanner.accept(result.stdout);
        scanner.accept(result.stderr);
        await engine.recordScript(execution, RunEventKind.ScriptCompleted, {
          request_id: id,
          exit_code: result.exit_code,
        });
        return result;
      },
      { max_parallel: run.config.value.limits.max_parallel },
    );
  };
}
