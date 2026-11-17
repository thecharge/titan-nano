import {
  ErrorCode,
  ExecutionPhase,
  NativeToolAudit,
  NativeToolRole,
  WorkflowField,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { NativeToolMessage } from "@titan/messages";
import {
  type NativeToolAuditRecord,
  NativeToolBoardSchema,
  type NativeToolScope,
  type Run,
} from "@titan/types";
import { runKnowledgeScope } from "./knowledge.ts";
import { isWorkerKey } from "./native-execution.ts";
import { workerAction } from "./reconciliation.ts";

export function nativeToolBoard(run: Run, scope: NativeToolScope, record: NativeToolAuditRecord) {
  const step = run.plan.nodes.find((node) => node.id === scope.step_id);
  const state = run.nodes[scope.step_id];
  const phase = Object.entries(state?.phases ?? {}).find(
    ([, value]) => value.execution_id === scope.execution_id && !value.completed,
  );
  if (
    !step ||
    !state ||
    !phase ||
    state.attempt !== scope.attempt ||
    scope.run_id !== run.run_id ||
    scope.part_id !== null ||
    scope.candidate_id !== runKnowledgeScope(run, step, state).candidate_id ||
    scope.role !== (isWorkerKey(phase[0]) ? NativeToolRole.Worker : NativeToolRole.Checker)
  )
    throw new TitanError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
  const action = phase[1].helper
    ? { persona: phase[1].helper.persona, task: phase[1].helper.question }
    : isWorkerKey(phase[0])
      ? workerAction(step, state)
      : step.falsify[Number(phase[0].slice(ExecutionPhase.FalsifierPrefix.length))];
  if (!action || !(WorkflowField.Persona in action))
    throw new TitanError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
  return NativeToolBoardSchema.parse({
    ...scope,
    ...record,
    kind: NativeToolAudit.Kind,
    from: action.persona,
  });
}
