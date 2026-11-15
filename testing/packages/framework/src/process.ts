import { type TestPredicate, type TestProcess, TestProcessDeadlineSchema } from "@titan/types";

export async function processExited(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

export async function waitUntil(
  predicate: TestPredicate,
  attempts = 100,
  interval = 10,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await predicate()) return true;
    await Bun.sleep(interval);
  }
  return false;
}

export async function withProcessDeadline<T>(
  child: TestProcess,
  milliseconds: number,
  action: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const duration = TestProcessDeadlineSchema.parse(milliseconds);
    timer = setTimeout(() => child.kill(), duration);
    return await action();
  } finally {
    clearTimeout(timer);
    child.kill();
    await child.exited;
  }
}
