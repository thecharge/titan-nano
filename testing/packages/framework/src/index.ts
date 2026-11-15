import type { TestAction } from "@titan/types";

export { processExited, waitUntil, withProcessDeadline } from "./process.ts";

export async function thrownBy(action: TestAction): Promise<unknown> {
  try {
    await action();
    return undefined;
  } catch (error) {
    return error;
  }
}
