import {
  ConfigDefault,
  ErrorCode,
  RuntimeLimit,
  SignalEvent,
  StoreEviction,
} from "@titan/constants";
import { assertSafeId } from "@titan/core";
import { OperationalError, TitanError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import { BoundedStore } from "@titan/store";
import {
  AgentCapacitySchema,
  type AsyncTask,
  type BackendActiveCounts,
  type BackendCapacity,
  BackendCapacitySchema,
  type BackendId,
  type CapacityRequest,
  CapacityRequestSchema,
  type CapacitySnapshot,
  type CapacityWaiter,
} from "@titan/types";

export class Capacity {
  private active = 0;
  private pending = 0;
  private backends: BackendActiveCounts = {};
  private backendLimits: BackendCapacity;
  private runs = new BoundedStore<string, number>({
    maxEntries: RuntimeLimit.ResidentRuns,
    eviction: StoreEviction.Reject,
  });
  private queues = new BoundedStore<string, CapacityWaiter[]>({
    maxEntries: RuntimeLimit.ResidentRuns,
    eviction: StoreEviction.Reject,
  });
  private order: string[] = [];
  constructor(
    private limit: number,
    private maximum: number = ConfigDefault.MaxPendingAgents,
    backendLimits: BackendCapacity = {},
  ) {
    if (
      !AgentCapacitySchema.safeParse({ max_active_agents: limit, max_pending_agents: maximum })
        .success ||
      !BackendCapacitySchema.safeParse(backendLimits).success
    )
      throw new TitanError(ErrorCode.Capacity, RunnerMessage.Capacity);
    this.backendLimits = BackendCapacitySchema.parse(backendLimits);
  }

  snapshot(): CapacitySnapshot {
    return {
      max_active_agents: this.limit,
      max_pending_agents: this.maximum,
      active: this.active,
      pending: this.pending,
      backends: { ...this.backends },
      backend_limits: { ...this.backendLimits },
    };
  }

  private available(key: string, backend: BackendId | null, maximum: number): boolean {
    if ((this.runs.get(key) ?? 0) >= maximum) return false;
    if (backend === null) return true;
    const limit = this.backendLimits[backend];
    return limit == null || (this.backends[backend] ?? 0) < limit;
  }

  private begin(key: string, backend: BackendId | null): void {
    this.runs.set(key, (this.runs.get(key) ?? 0) + 1);
    this.active++;
    if (backend !== null) this.backends[backend] = (this.backends[backend] ?? 0) + 1;
  }

  private next(): CapacityWaiter | undefined {
    const turns = this.order.length;
    for (let turn = 0; turn < turns; turn++) {
      const key = this.order.shift();
      if (!key) continue;
      const queue = this.queues.get(key);
      const index =
        queue?.findIndex((entry) => this.available(key, entry.backend, entry.max_parallel)) ?? -1;
      const next = index < 0 ? undefined : queue?.splice(index, 1)[0];
      if (queue?.length) this.order.push(key);
      else this.queues.delete(key);
      if (next) return next;
    }
    return undefined;
  }

  private pump(): void {
    while (this.active < this.limit && this.order.length) {
      const next = this.next();
      if (!next) break;
      this.pending--;
      this.begin(next.key, next.backend);
      next.start();
    }
  }

  private remove(key: string, waiter: CapacityWaiter): void {
    const queue = this.queues.get(key);
    const index = queue?.indexOf(waiter) ?? -1;
    if (index < 0) return;
    queue?.splice(index, 1);
    this.pending--;
    if (queue?.length) return;
    this.queues.delete(key);
    this.order = this.order.filter((entry) => entry !== key);
  }

  private async acquire(
    key: string,
    signal: AbortSignal,
    backend: BackendId | null,
    maximum: number,
  ): Promise<void> {
    if (this.active < this.limit && this.available(key, backend, maximum)) {
      this.begin(key, backend);
      return;
    }
    if (this.pending >= this.maximum)
      throw new OperationalError(ErrorCode.Capacity, RunnerMessage.PendingCapacity);
    const { promise, resolve: start, reject } = Promise.withResolvers<void>();
    const waiter = { key, start, backend, max_parallel: maximum };
    const abort = (): void => {
      this.remove(key, waiter);
      reject(signal.reason);
    };
    try {
      const queue = this.queues.get(key) ?? [];
      if (!this.queues.has(key)) {
        this.queues.set(key, queue);
        this.order.push(key);
      }
      queue.push(waiter);
      this.pending++;
      signal.addEventListener(SignalEvent.Abort, abort, { once: true });
      this.pump();
      await promise;
    } finally {
      signal.removeEventListener(SignalEvent.Abort, abort);
    }
  }

  async use<T>(
    key: string,
    signal: AbortSignal,
    work: AsyncTask<T>,
    request: CapacityRequest = {},
  ): Promise<T> {
    assertSafeId(key);
    signal.throwIfAborted();
    const parsed = CapacityRequestSchema.parse(request);
    const backend = parsed.backend ?? null;
    await this.acquire(key, signal, backend, parsed.max_parallel ?? this.limit);
    try {
      signal.throwIfAborted();
      return await work();
    } finally {
      this.active--;
      if (backend !== null) this.backends[backend] = (this.backends[backend] ?? 1) - 1;
      const remaining = (this.runs.get(key) ?? 1) - 1;
      if (remaining) this.runs.set(key, remaining);
      else this.runs.delete(key);
      this.pump();
    }
  }
}
