import { test } from "bun:test";
import { LiveEnabledValue, type LiveGroup } from "@titan/constants";
import { liveKeyMissing } from "@titan/messages";

export function liveDecision(
  environment: Record<string, string | undefined>,
  group: LiveGroup,
  keys: string[],
) {
  if (environment[group] !== LiveEnabledValue) return { run: false, failure: undefined };
  const missing = keys.find((key) => !environment[key]);
  return { run: true, failure: missing === undefined ? undefined : liveKeyMissing(missing) };
}

export async function liveRun(failure: string | undefined, action: () => Promise<void>) {
  if (failure !== undefined) throw new Error(failure);
  await action();
}

export function liveTest(
  group: LiveGroup,
  keys: string[],
  name: string,
  action: () => Promise<void>,
) {
  const decision = liveDecision(process.env, group, keys);
  test.skipIf(!decision.run)(name, liveRun.bind(undefined, decision.failure, action));
}
