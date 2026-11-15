import { strict as assert } from "node:assert";
import { waitUntil } from "@titan/test-framework";

export async function waitObservation(readyAt: number, attempts: number, interval: number) {
  let calls = 0;
  const started = performance.now();
  const ready = await waitUntil(async () => ++calls === readyAt, attempts, interval);
  const waits = ready ? calls - 1 : calls;
  assert.equal(calls, ready ? readyAt : attempts);
  assert.ok(performance.now() - started >= waits * interval - 2);
  return ready;
}
