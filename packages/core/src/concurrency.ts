import { ConcurrencyDefault, ErrorCode, TaskOutcome } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { invalidConcurrencyLimit } from "@titan/messages";
import type { AsyncResults, AsyncTask } from "@titan/types";

export function all<const T extends readonly AsyncTask<unknown>[]>(
  tasks: T,
  limit?: number,
): Promise<AsyncResults<T>>;
export async function all<T>(
  tasks: readonly AsyncTask<T>[],
  limit: number = ConcurrencyDefault,
): Promise<T[]> {
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new TitanError(ErrorCode.Capacity, invalidConcurrencyLimit);
  const results: T[] = [];
  let next = 0;
  let failed = false;
  let failure: unknown;
  const worker = async (): Promise<void> => {
    while (!failed && next < tasks.length) {
      const index = next++;
      const task = tasks[index];
      if (!task) continue;
      try {
        results[index] = await task();
      } catch (error) {
        failure = failed ? failure : error;
        failed = true;
      }
    }
  };
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  for (const active of workers) await active;
  if (failed) throw failure;
  return results;
}

export async function settle<T>(
  tasks: readonly AsyncTask<T>[],
  limit: number = ConcurrencyDefault,
): Promise<PromiseSettledResult<T>[]> {
  return all(
    tasks.map((task) => async (): Promise<PromiseSettledResult<T>> => {
      try {
        return { status: TaskOutcome.Fulfilled, value: await task() };
      } catch (reason) {
        return { status: TaskOutcome.Rejected, reason };
      }
    }),
    limit,
  );
}
