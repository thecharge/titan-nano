import { ErrorCode, RunStatus, SignalEvent, StepStatus, TimerLimit } from "@titan/constants";
import type { NodeState, Run } from "@titan/types";

export function retryAt(node: NodeState): number | null {
  return (
    Object.values(node.phases).find((phase) => !phase.completed && phase.next_retry !== null)
      ?.next_retry ?? null
  );
}

export function nextRetry(run: Run): number | null {
  let next: number | null = null;
  for (const node of Object.values(run.nodes)) {
    const retry = retryAt(node);
    if (node.state === StepStatus.Pending && retry !== null) next = Math.min(next ?? retry, retry);
  }
  return next;
}

export function limitReset(run: Run): number | null {
  let next: number | null = null;
  for (const node of Object.values(run.nodes))
    for (const phase of Object.values(node.phases))
      if (
        node.state === StepStatus.Blocked &&
        !phase.completed &&
        phase.next_retry !== null &&
        phase.error?.startsWith(ErrorCode.UsageLimit)
      )
        next = Math.min(next ?? phase.next_retry, phase.next_retry);
  return next;
}

export function projectRunStatus(run: Run): void {
  if (run.state !== RunStatus.Running && run.state !== RunStatus.Recovering) return;
  let recovering = false;
  for (const node of Object.values(run.nodes)) {
    const retry = retryAt(node);
    if (node.state === StepStatus.Running && retry === null) {
      run.state = RunStatus.Running;
      return;
    }
    if ((node.state === StepStatus.Running || node.state === StepStatus.Pending) && retry !== null)
      recovering = true;
  }
  run.state = recovering ? RunStatus.Recovering : RunStatus.Running;
}

export async function waitForRetry(until: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((done, fail) => {
    const abort = (): void => {
      clearTimeout(timer);
      fail(signal.reason);
    };
    const timer = setTimeout(
      () => {
        signal.removeEventListener(SignalEvent.Abort, abort);
        done();
      },
      Math.min(TimerLimit.Milliseconds, Math.max(0, until - Date.now())),
    );
    signal.addEventListener(SignalEvent.Abort, abort, { once: true });
  });
}
