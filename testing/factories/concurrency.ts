import { strict as assert } from "node:assert";
import { all, settle } from "@titan/core";

export async function boundedWork(limit: number, count: number) {
  let active = 0;
  let peak = 0;
  const values = await all(
    Array.from({ length: count }, (_, index) => async () => {
      active++;
      peak = Math.max(peak, active);
      await Bun.sleep(1);
      active--;
      return index;
    }),
    limit,
  );
  return { values, peak };
}

export async function stoppedWork(limit: number, failure: unknown) {
  const started: number[] = [];
  const tasks = Array.from({ length: 4 }, (_, index) => async () => {
    started.push(index);
    if (index === 0) throw failure;
    await Bun.sleep(1);
    return index;
  });
  try {
    await all(tasks, limit);
  } catch (error) {
    return { error, started };
  }
}

export async function settledWork(limit: number, failures: number) {
  let active = 0;
  let peak = 0;
  const results = await settle(
    Array.from({ length: 4 }, (_, index) => async () => {
      active++;
      peak = Math.max(peak, active);
      await Bun.sleep(1);
      active--;
      if (index < failures) throw index;
      return index;
    }),
    limit,
  );
  return { results, peak };
}

export async function competingFailures(first: unknown, later: unknown) {
  const release = Promise.withResolvers<void>();
  const started: number[] = [];
  let completed = false;
  const tasks = Array.from({ length: 4 }, (_, index) => async () => {
    started.push(index);
    if (index === 0) throw first;
    await release.promise;
    throw later;
  });
  const pending = settle([() => all(tasks, 2)]).then((results) => {
    completed = true;
    return results[0];
  });
  try {
    await Bun.sleep(1);
    assert.equal(completed, false);
    assert.deepEqual(started, [0, 1]);
  } finally {
    release.resolve();
    await pending;
  }
  return { result: await pending, started };
}
