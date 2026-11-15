// The part of a titan RunPod backend that keeps a whole run inside its time limit (at most 1 hour).
// Every job gets policy.executionTimeout and policy.ttl no longer than the time left in the run.
// At the deadline, every open job is cancelled.
import { SCALE } from "./fake-runpod";

export const MAX_RUN_MS = 3600000; // 1 hour, the user's limit for one workflow
// titan cancels its own jobs this long before the deadline, so that it acts before RunPod's ttl removes them.
// 30 s is a guess that has not been measured.
export const CANCEL_MARGIN_MS = 30000;
export function checkLimit(minutes: number): string | null {
  return minutes * 60000 > MAX_RUN_MS ? `limits.max_minutes is ${minutes}, but a run that uses RunPod may last at most 60 minutes` : null;
}

export class RunClock {
  readonly deadline: number;
  constructor(limitMs: number, readonly now: () => number) { this.deadline = now() + Math.min(limitMs, MAX_RUN_MS); }
  left() { return this.deadline - this.now(); }
}

export class RunpodQueue {
  open = new Set<string>();
  sent: { step: string; executionTimeout: number; ttl: number }[] = [];
  constructor(readonly base: string, readonly key: string, readonly clock: RunClock, readonly useDeadline = true) {}
  private call(path: string, body?: any) {
    return fetch(`${this.base}/v2/ep/${path}`, { method: body ? "POST" : path.startsWith("cancel") ? "POST" : "GET", headers: { authorization: this.key, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  }
  // Returns the job's last status, or "timed_out" when titan did not send it because too little time was left.
  async runStep(step: string): Promise<string> {
    const left = this.clock.left();
    if (this.useDeadline && left - CANCEL_MARGIN_MS < 10000) return "timed_out"; // RunPod's smallest ttl is 10 s
    const policy = this.useDeadline ? { executionTimeout: Math.max(5000, left), ttl: left } : {};
    const r = await (await this.call("run", { input: { step }, policy })).json();
    this.sent.push({ step, executionTimeout: (policy as any).executionTimeout, ttl: (policy as any).ttl });
    this.open.add(r.id);
    for (;;) {
      await Bun.sleep(5);
      if (this.useDeadline && this.clock.left() <= CANCEL_MARGIN_MS) { await this.cancelAll(); return "timed_out"; }
      const res = await this.call(`status/${r.id}`);
      if (res.status === 404) { this.open.delete(r.id); return "removed (ttl ended)"; }
      const s = await res.json();
      if (!["IN_QUEUE", "IN_PROGRESS"].includes(s.status)) { this.open.delete(r.id); return s.status; }
    }
  }
  async cancelAll() { const ids = [...this.open]; this.open.clear(); for (const id of ids) await this.call(`cancel/${id}`, {}); }
}
export { SCALE };
