import { ErrorCode, FileReconciliation, RequestKind, StepStatus } from "@titan/constants";
import { hash } from "@titan/core";
import { OperationalError, TitanError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import type { RequestLedger } from "@titan/requests";
import type { NodeState, Run, Step } from "@titan/types";
import { readTree, treeHash } from "@titan/workspace";
import { readLiveWriteTree, rollBack, scoped } from "./live.ts";
import { verifyReconciliation } from "./reconciliation.ts";
import { withWriteInputs } from "./write-inputs.ts";

export async function reconcileFiles(
  run: Run,
  step: Step,
  state: NodeState,
  candidate: string,
  ledger: RequestLedger,
): Promise<void> {
  const input = state.reconciliations?.at(-1)?.input ?? state.input;
  if (!input) throw new TitanError(ErrorCode.MissingWorkspace, step.id);
  await verifyReconciliation(run, step, state);
  try {
    await rollBack(run, step, input, candidate);
    return;
  } catch (error) {
    if (!(error instanceof OperationalError) || error.code !== ErrorCode.FileConflict) throw error;
  }
  const limits = run.config.value.limits;
  const scope = {
    operation: FileReconciliation.Operation,
    resource: step.id,
    content_hashes: {
      current: await treeHash(await readLiveWriteTree(run, step)),
      candidate: await treeHash(scoped(run, step, await readTree(candidate, limits))),
      before: await treeHash(
        scoped(run, step, await withWriteInputs(run, step, await readTree(input, limits))),
      ),
    },
    arguments: [RunnerMessage.FileReconciliation, String(state.attempt)],
    environment_names: [],
  };
  const id = FileReconciliation.Prefix + hash(JSON.stringify(scope));
  const request =
    (await ledger.list(run.run_id)).find((entry) => entry.request_id === id) ??
    (await ledger.open(run.run_id, {
      request_id: id,
      kind: RequestKind.Ask,
      scope,
      origin: { client_id: run.client_id, harness_session_id: null },
      expires_at: Date.now() + FileReconciliation.ExpiresMs,
    }));
  if (request.answer === null) {
    state.state = StepStatus.Waiting;
    throw new OperationalError(ErrorCode.RequestWaiting, RunnerMessage.FileReconciliation);
  }
  await ledger.approved(run.run_id, request.request_id, RequestKind.Ask, scope);
  await rollBack(run, step, input, candidate, true);
}
