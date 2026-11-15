import { ErrorCode, StoreEviction } from "@titan/constants";
import { all } from "@titan/core";
import { TitanError } from "@titan/errors";
import { BoundedStore, KeyedQueue } from "@titan/store";
import { thrownBy } from "@titan/test-framework";
import { storeEntrySchema } from "@titan/types";
import { z } from "zod";

export function observedStore(
  maxEntries: number,
  eviction: StoreEviction,
  values: number[],
  touch?: number,
) {
  const store = new BoundedStore<number, number>({ maxEntries, eviction });
  values.forEach((value, index) => {
    if (index === 2 && touch !== undefined) store.get(touch);
    store.set(value, value);
  });
  return { keys: [...store.keys()], values: [...store.values()], size: store.size };
}

export async function observedQueue(keys: string[], limit: number, failIndex: number | null) {
  const queue = new KeyedQueue(limit);
  let active = 0;
  let peak = 0;
  const values = await all(
    keys.map(
      (key, index) => async () =>
        queue
          .use(key, async () => {
            active++;
            peak = Math.max(peak, active);
            try {
              await Bun.sleep(1);
              if (index === failIndex)
                throw new TitanError(ErrorCode.Arguments, "Synthetic failure");
              return index;
            } finally {
              active--;
            }
          })
          .catch((error: unknown) => (error instanceof TitanError ? error.code : error)),
    ),
  );
  return { values, peak };
}

export async function observedExpiry(ttlMs: number | null, elapsed: number) {
  let now = 100;
  const store = new BoundedStore<number, number>({ maxEntries: 1, ttlMs }, () => now);
  store.set(1, 10);
  now += elapsed;
  return { present: store.has(1), value: store.get(1), size: store.size };
}

export async function observedUpdate(
  initial: number | undefined,
  next: number | undefined,
  failure?: ErrorCode,
) {
  const store = new BoundedStore<number, number>({ maxEntries: 2, eviction: StoreEviction.Reject });
  if (initial !== undefined) store.set(1, initial);
  if (failure) store.set(2, 20);
  let result: number | undefined;
  const error = await thrownBy(async () => {
    result = store.update(failure === ErrorCode.Capacity ? 3 : 1, () => {
      if (failure === ErrorCode.Arguments)
        throw new TitanError(ErrorCode.Arguments, "Synthetic updater failure");
      return next;
    });
  });
  return {
    result,
    error: error instanceof TitanError ? error.code : error,
    keys: [...store.keys()],
    values: [...store.values()],
    size: store.size,
  };
}

export async function parsedStoreEntry(value: unknown) {
  return storeEntrySchema(z.number().int()).parse(value);
}
