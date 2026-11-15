import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveConfig } from "@titan/config";
import { Backend, RunStatus, TaskOutcome } from "@titan/constants";
import { settle } from "@titan/core";
import { TitanError } from "@titan/errors";
import { Capacity, Engine } from "@titan/runner";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { BackendId } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import {
  backendCapacityPeerWorkflow,
  backendCapacityProbe,
  backendCapacityWorkflow,
  peerBackend,
} from "../support/backend-capacity.ts";
import { isolatedWorkspace } from "../support/isolated.ts";

export async function backendCapacityAdmission(
  backend: BackendId,
  sameRun: boolean,
  cancel: boolean,
  fail: boolean,
  maximum: number = 4,
) {
  const capacity = new Capacity(2, maximum, { [backend]: 1 });
  const signal = new AbortController();
  const waiting = new AbortController();
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  let active = 0;
  let peak = 0;
  let starts = 0;
  let peer = false;
  async function limited(): Promise<void> {
    starts++;
    active++;
    peak = Math.max(peak, active);
    try {
      entered.resolve();
      await release.promise;
      if (fail) throw new Error("Deliberate limited backend failure");
    } finally {
      active--;
    }
  }
  const owner = capacity.use("owner", signal.signal, limited, { backend });
  const observedOwner = owner.catch(() => "failed");
  await entered.promise;
  const key = sameRun ? "owner" : "waiting";
  const queued = capacity.use(key, waiting.signal, limited, { backend }).catch((error) => {
    if (error instanceof TitanError) return error.code;
    return cancel ? "cancelled" : "failed";
  });
  const snapshot = capacity.snapshot();
  assert.equal(snapshot.active, 1);
  assert.equal(snapshot.pending, maximum === 0 ? 0 : 1);
  assert.equal(snapshot.backends[backend], 1);
  assert.equal(snapshot.backend_limits[backend], 1);
  snapshot.backends[backend] = 100;
  snapshot.backend_limits[backend] = 100;
  assert.equal(capacity.snapshot().backends[backend], 1);
  assert.equal(capacity.snapshot().backend_limits[backend], 1);
  const other = capacity.use(
    key,
    signal.signal,
    async () => {
      peer = true;
    },
    { backend: peerBackend(backend) },
  );
  try {
    assert.ok(await waitUntil(async () => peer), "An unrelated backend must start before release");
    const peerBeforeRelease = peer;
    if (cancel) waiting.abort();
    release.resolve();
    await observedOwner;
    const queuedResult = await queued;
    await other;
    return { peerBeforeRelease, starts, peak, active, queuedResult: queuedResult ?? null };
  } finally {
    release.resolve();
    await settle([() => observedOwner, () => queued, () => other]);
  }
}

export async function backendCapacityRun(
  backend: BackendId,
  splitRuns: boolean,
  cancel: boolean,
  checker = false,
) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    const workflow = { limits: { max_parallel: 2 } };
    const config = await resolveConfig({
      home: root,
      project,
      workflow,
      overrides: isolatedWorkspace,
    });
    const probe = backendCapacityProbe(backend, checker);
    const engine = new Engine(() => probe.fake, {
      max_active_agents: 2,
      backend_limits: { [backend]: 1 },
    });
    const plan = validateWorkflow(backendCapacityWorkflow(backend, splitRuns, checker));
    const owner = await engine.create({
      plan,
      project,
      config,
      backend: Backend.Fake,
      client_id: "owner",
      submission_id: "owner",
    });
    const ownerWork = engine.start(owner.run_id);
    await probe.entered;
    const other = splitRuns
      ? await engine.create({
          plan: validateWorkflow(backendCapacityPeerWorkflow(backend)),
          project,
          config,
          backend: Backend.Fake,
          client_id: "peer",
          submission_id: "peer",
        })
      : null;
    const otherWork = other ? engine.start(other.run_id) : Promise.resolve();
    try {
      assert.ok(
        await waitUntil(async () => probe.statistics().peer),
        "The independent workflow branch must run",
      );
      const peerBeforeRelease = probe.statistics().peer;
      const cancellation = cancel ? engine.cancel(owner.run_id) : Promise.resolve();
      probe.release();
      await cancellation;
      await ownerWork;
      await otherWork;
      const final = await engine.snapshot(owner.run_id);
      assert.equal(final.state, cancel ? RunStatus.Cancelled : RunStatus.Passed);
      return {
        peerBeforeRelease,
        peak: probe.statistics().peak,
        active: probe.statistics().active,
        state: final.state,
        peerState: other ? (await engine.snapshot(other.run_id)).state : null,
        attempts: Object.values(final.nodes).map((node) => node.attempt),
        refutations: Object.values(final.nodes).map((node) => node.refutations),
      };
    } finally {
      probe.release();
      const settled = await settle([() => ownerWork, () => otherWork]);
      assert.ok(settled.every((result) => result.status === TaskOutcome.Fulfilled));
    }
  });
}

export async function capacityRunCeiling(limit: number, fail: boolean) {
  const capacity = new Capacity(3, 4);
  const signal = new AbortController().signal;
  let active = 0;
  let peak = 0;
  let completed = 0;
  function task(index: number) {
    const backend = index % 2 ? Backend.Codex : Backend.Claude;
    async function work(): Promise<void> {
      active++;
      peak = Math.max(peak, active);
      try {
        await Bun.sleep(10);
        if (fail && index === 0) throw new Error("Deliberate run failure");
      } finally {
        active--;
        completed++;
      }
    }
    return capacity.use("run", signal, work, { backend, max_parallel: limit });
  }
  const results = await settle([0, 1, 2, 3].map((index) => () => task(index)));
  return {
    peak,
    active,
    completed,
    failures: results.filter((result) => result.status === TaskOutcome.Rejected).length,
  };
}

export async function capacityQueuedBackend(backend: BackendId, cancel: boolean) {
  const capacity = new Capacity(2, 4, { [backend]: 1 });
  const signal = new AbortController().signal;
  const waiting = new AbortController();
  const held = Promise.withResolvers<void>();
  const heldEntered = Promise.withResolvers<void>();
  const blocker = Promise.withResolvers<void>();
  const blockerEntered = Promise.withResolvers<void>();
  let peer = false;
  let starts = 0;
  async function limited(): Promise<void> {
    starts++;
    heldEntered.resolve();
    await held.promise;
  }
  async function occupy(): Promise<void> {
    blockerEntered.resolve();
    await blocker.promise;
  }
  const owner = capacity.use("owner", signal, limited, { backend });
  const occupied = capacity.use("blocker", signal, occupy);
  await heldEntered.promise;
  await blockerEntered.promise;
  const queued = capacity
    .use("waiting", waiting.signal, limited, { backend })
    .catch(() => "cancelled");
  const other = capacity.use(
    "waiting",
    signal,
    async () => {
      peer = true;
    },
    { backend: peerBackend(backend) },
  );
  try {
    assert.equal(peer, false);
    if (cancel) waiting.abort();
    blocker.resolve();
    await occupied;
    assert.ok(await waitUntil(async () => peer), "Admission must scan past a blocked backend");
    const peerBeforeHeldRelease = peer;
    held.resolve();
    await owner;
    const queuedResult = await queued;
    await other;
    return { peerBeforeHeldRelease, starts, queuedResult: queuedResult ?? null };
  } finally {
    held.resolve();
    blocker.resolve();
    await settle([() => owner, () => occupied, () => queued, () => other]);
  }
}
