import { strict as assert } from "node:assert";
import { FakeBackend } from "@titan/backend-fake";
import { Backend, SignalEvent } from "@titan/constants";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import type { AgentSpec, BackendId } from "@titan/types";

export function peerBackend(backend: BackendId): BackendId {
  return backend === Backend.Claude ? Backend.Codex : Backend.Claude;
}

export function backendCapacityWorkflow(backend: BackendId, splitRuns: boolean, checker = false) {
  const base = vendorRecoveryWorkflow();
  const step = base.steps[0];
  assert.ok(step);
  const checkerSettings = checker ? { backend, model: backend } : {};
  const personas = {
    ...base.personas,
    worker: {
      ...base.personas.worker,
      backend: checker ? peerBackend(backend) : backend,
      model: checker ? "worker" : backend,
    },
    checker: {
      ...base.personas.checker,
      ...checkerSettings,
    },
    peer: { ...base.personas.worker, backend: peerBackend(backend), model: "peer" },
  };
  const other = {
    ...step,
    id: "peer",
    files: ["peer.txt"],
    do: { persona: "peer", task: "complete" },
  };
  const parallel = [
    { ...step, id: "held", files: ["held.txt"] },
    { ...step, id: "queued", files: ["queued.txt"] },
    ...(!splitRuns ? [other] : []),
  ];
  return { ...base, limits: { max_parallel: 2 }, personas, steps: [{ parallel }] };
}

export function backendCapacityPeerWorkflow(backend: BackendId) {
  const base = vendorRecoveryWorkflow();
  const personas = {
    ...base.personas,
    worker: { ...base.personas.worker, backend: peerBackend(backend), model: "peer" },
  };
  return { ...base, personas, steps: base.steps.map((step) => ({ ...step, files: ["peer.txt"] })) };
}

export function backendCapacityProbe(backend: BackendId, checker = false) {
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  let held = false;
  let peer = false;
  let active = 0;
  let peak = 0;
  function answer(spec: AgentSpec, marker: string) {
    if (!spec.writable) return { json: { verdict: "survived", evidence: "Inspected candidate" } };
    return { json: { ok: true, marker, turn: 1 } };
  }
  async function respond(spec: AgentSpec, _prompt: string, signal: AbortSignal) {
    if (spec.model === "peer" && spec.writable) peer = true;
    if (spec.writable === checker) return answer(spec, "worker");
    if (spec.model !== backend) {
      return answer(spec, "peer");
    }
    active++;
    peak = Math.max(peak, active);
    const abort = (): void => {
      cancelled.resolve();
      release.resolve();
    };
    signal.addEventListener(SignalEvent.Abort, abort, { once: true });
    try {
      if (signal.aborted) abort();
      if (!held) {
        held = true;
        entered.resolve();
        await release.promise;
      }
      return answer(spec, "limited");
    } finally {
      signal.removeEventListener(SignalEvent.Abort, abort);
      active--;
    }
  }
  return {
    fake: new FakeBackend(respond),
    entered: entered.promise,
    cancelled: cancelled.promise,
    release: release.resolve,
    statistics: () => ({ peer, active, peak }),
  };
}
