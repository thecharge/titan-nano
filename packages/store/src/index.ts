import { ErrorCode, StoreEviction } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { StoreMessage } from "@titan/messages";
import {
  type AsyncTask,
  type StoreClock,
  type StoreEntry,
  type StoreOptions,
  StoreOptionsSchema,
  type StoreUpdate,
} from "@titan/types";

export class BoundedStore<K, V> {
  private entries = new Map<K, StoreEntry<V>>();
  private options;

  constructor(
    options: StoreOptions,
    private clock: StoreClock = Date.now,
  ) {
    this.options = StoreOptionsSchema.parse(options);
  }

  private prune(): void {
    const now = this.clock();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  get size(): number {
    this.prune();
    return this.entries.size;
  }

  has(key: K): boolean {
    this.prune();
    return this.entries.has(key);
  }

  get(key: K): V | undefined {
    this.prune();
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    this.prune();
    if (!this.entries.has(key) && this.entries.size >= this.options.maxEntries) this.evict();
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: this.options.ttlMs === null ? null : this.clock() + this.options.ttlMs,
    });
  }

  private evict(): void {
    if (this.options.eviction === StoreEviction.Reject)
      throw new OperationalError(ErrorCode.Capacity, StoreMessage.Capacity);
    const oldest = this.entries.keys().next();
    if (!oldest.done) this.entries.delete(oldest.value);
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  update(key: K, apply: StoreUpdate<V>): V | undefined {
    this.prune();
    const value = apply(this.entries.get(key)?.value);
    if (value === undefined) this.delete(key);
    else this.set(key, value);
    return value;
  }

  *keys(): IterableIterator<K> {
    this.prune();
    yield* this.entries.keys();
  }

  *values(): IterableIterator<V> {
    this.prune();
    for (const entry of this.entries.values()) yield entry.value;
  }
}

export class KeyedQueue {
  private tails: BoundedStore<string, Promise<void>>;
  private pending = 0;
  constructor(private limit: number) {
    this.tails = new BoundedStore({ maxEntries: limit, eviction: StoreEviction.Reject });
  }

  async drain(key: string): Promise<void> {
    await this.tails.get(key);
  }

  async use<T>(key: string, action: AsyncTask<T>): Promise<T> {
    if (this.pending >= this.limit)
      throw new OperationalError(ErrorCode.Capacity, StoreMessage.Pending);
    const previous = this.tails.get(key);
    const { promise: gate, resolve: release } = Promise.withResolvers<void>();
    const tail = (previous ?? Promise.resolve()).then(() => gate);
    this.tails.set(key, tail);
    this.pending++;
    try {
      await previous;
      return await action();
    } finally {
      release();
      this.pending--;
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}
