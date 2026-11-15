import { strict as assert } from "node:assert";
import { ErrorCode, ExecutionPhase } from "@titan/constants";
import type { Run } from "@titan/types";

export function assertRecoveryCheckpoint(run: Run, worker: boolean) {
  const node = run.nodes.deliver;
  assert.ok(node);
  assert.equal(node.attempt, 1);
  assert.equal(node.refutations, 0);
  assert.deepEqual(node.evidence, []);
  const key = worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`;
  const phase = node.phases[key];
  assert.ok(phase?.session_id && phase.execution_id);
  assert.equal(phase.executions, 1);
  assert.equal(phase.retries, 0);
  assert.equal(phase.completed, false);
  assert.deepEqual(phase.usage, []);
  assert.equal(phase.error?.startsWith(`${ErrorCode.RateLimited}:`), true);
  assert.ok(phase.next_retry !== null && phase.next_retry > Date.now());
  assert.equal(node.phases[ExecutionPhase.Worker]?.completed, !worker);
  return phase;
}
