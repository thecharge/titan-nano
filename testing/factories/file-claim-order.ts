import { strict as assert } from "node:assert";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { initialPhase, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  Backend,
  ErrorCode,
  ExecutionPhase,
  FileAccessMode,
  RunEventKind,
  StepStatus,
} from "@titan/constants";
import { newId, settle } from "@titan/core";
import { Engine, FileAccess } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { FileAccessClaimSchema, ObjectSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function reconciliationClaim(writable: boolean, script: boolean) {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(
      () => new FakeBackend(),
      {},
      {
        scripts: async () => {
          throw new Error("Claim inspection must not dispatch a script");
        },
      },
    );
    const run = await engine.create({
      project,
      plan: validateWorkflow({
        name: "Reconciliation claim",
        goal: "Reserve the required access before receiving work",
        personas: {
          reader: { description: "Reader", role: "Read", tools: [AgentTool.Read] },
          merger: {
            description: "Merger",
            role: "Merge",
            tools: writable ? [AgentTool.Write] : [AgentTool.Read],
          },
          checker: { description: "Checker", role: "Challenge", tools: [AgentTool.Read] },
        },
        steps: [
          {
            id: "deliver",
            do: script ? { script: "printf received" } : { persona: "reader", task: "Read" },
            reconcile: { persona: "merger", task: "Merge retained files" },
            falsify: [{ persona: "checker", task: "Challenge" }],
          },
        ],
      }),
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "claim",
      submission_id: "claim",
    });
    const step = run.plan.nodes[0];
    assert.ok(step);
    let mode: FileAccessMode | undefined;
    const files = new FileAccess(async (_run, type, data) => {
      if (type === RunEventKind.FileAccessAcquired) mode = FileAccessClaimSchema.parse(data).mode;
    }, 2);
    await files.use(run, step, new AbortController().signal, async () => {});
    assert.equal(mode, writable || script ? FileAccessMode.Write : FileAccessMode.Read);
    return true;
  });
}

export async function fileClaimBinding(retained: boolean, fail: boolean) {
  return withTemporaryDirectory(async (project) => {
    const run = await new Engine(() => new FakeBackend()).create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "binding",
      submission_id: "binding",
    });
    const step = run.plan.nodes[0];
    const node = step ? run.nodes[step.id] : undefined;
    assert.ok(step && node);
    node.state = StepStatus.Running;
    const phase = initialPhase();
    node.phases.worker = phase;
    let rejecting = false;
    const store = new RunStore(run.root);
    await store.read();
    const files = new FileAccess(async (state, type, data) => {
      if (rejecting && type === RunEventKind.FileAccessBound)
        throw new Error("Injected binding persistence failure");
      await store.commit(state, type, data);
    }, 2);
    return files.use(run, step, new AbortController().signal, async () => {
      const origin = {
        step_id: step.id,
        attempt: node.attempt,
        phase: ExecutionPhase.Worker,
        execution_id: newId(),
      };
      if (retained) await files.bind(run, step, origin);
      const previous = structuredClone(phase);
      rejecting = fail;
      const error = await thrownBy(() =>
        files.bind(run, step, { ...origin, execution_id: newId() }),
      );
      assert.equal(error !== undefined, fail);
      if (fail) assert.deepEqual(phase, previous);
      else {
        assert.ok(phase.file_claim);
        assert.notEqual(phase.execution_id, previous.execution_id);
      }
      return true;
    });
  });
}

export async function fileClaimCapacity(nested: boolean, refuse: boolean) {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const original = workflow.steps[0];
    assert.ok(original);
    const plan = validateWorkflow({
      ...workflow,
      steps: [
        { ...original, files: [nested ? "folder" : "result.txt"] },
        { ...original, id: "second", files: [nested ? "folder/result.txt" : "result.txt"] },
        { ...original, id: "third", files: [nested ? "folder/other.txt" : "result.txt"] },
      ],
    });
    const run = await new Engine(() => new FakeBackend()).create({
      project,
      plan,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "capacity",
      submission_id: "capacity",
    });
    const store = new RunStore(run.root);
    await store.read();
    let waiting = 0;
    const files = new FileAccess(
      async (state, type, data) => {
        await store.commit(state, type, data);
        if (type === RunEventKind.FileAccessWaiting) waiting++;
      },
      refuse ? 1 : 2,
    );
    const release = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const signal = new AbortController().signal;
    const [owner, second, third] = plan.nodes;
    assert.ok(owner && second && third);
    const acquired: string[] = [];
    const first = files.use(run, owner, signal, async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const queued = thrownBy(() =>
      files.use(run, second, signal, async () => {
        acquired.push(second.id);
      }),
    );
    let last: Promise<unknown> | undefined;
    try {
      assert.ok(await waitUntil(async () => waiting === 1));
      last = thrownBy(() =>
        files.use(run, third, signal, async () => {
          acquired.push(third.id);
        }),
      );
      if (refuse) assert.equal(Reflect.get(Object(await last), "code"), ErrorCode.Capacity);
      else assert.ok(await waitUntil(async () => waiting === 2));
    } finally {
      release.resolve();
      await first;
      assert.equal(await queued, undefined);
      if (last) await last;
    }
    assert.deepEqual(acquired, refuse ? [second.id] : [second.id, third.id]);
    return true;
  });
}

export async function fileClaimOrdering(nested: boolean, cancel: boolean) {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const step = workflow.steps[0];
    assert.ok(step);
    const plan = validateWorkflow({
      ...workflow,
      steps: [
        { ...step, files: [nested ? "folder" : "result.txt"] },
        { ...step, id: "peer", files: [nested ? "folder/result.txt" : "result.txt"] },
      ],
    });
    const engine = new Engine(() => new FakeBackend());
    const run = await engine.create({
      project,
      plan,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "file-order",
      submission_id: "same-tree",
    });
    const store = new RunStore(run.root);
    await store.read();
    const canonical = await realpath(project);
    const resolving = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const started: string[] = [];
    let calls = 0;
    const files = new FileAccess(
      (run, type, data) => store.commit(run, type, data),
      4,
      async () => {
        calls++;
        if (calls === 1) {
          resolving.resolve();
          await release.promise;
        }
        return canonical;
      },
    );
    const controller = new AbortController();
    const firstStep = plan.nodes[0];
    const peerStep = plan.nodes[1];
    assert.ok(firstStep && peerStep);
    const first = thrownBy(() =>
      files.use(run, firstStep, controller.signal, async () => {
        started.push("first");
      }),
    );
    await resolving.promise;
    const peer = files.use(run, peerStep, new AbortController().signal, async () => {
      started.push("peer");
    });
    try {
      await waitUntil(async () => started.length > 0, 2, 10);
      if (cancel) controller.abort();
    } finally {
      release.resolve();
    }
    await peer;
    const error = await first;
    assert.equal(error !== undefined, cancel);
    assert.deepEqual(started, cancel ? ["peer"] : ["first", "peer"]);
    const acquired: string[] = [];
    for await (const event of store.events())
      if (event.type === RunEventKind.FileAccessAcquired)
        acquired.push(FileAccessClaimSchema.parse(event.data).step_id);
    assert.deepEqual(acquired, cancel ? [peerStep.id] : [firstStep.id, peerStep.id]);
    return true;
  });
}

export async function fileReaderPrecedence(nested: boolean, cancel: boolean) {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const source = workflow.steps[0];
    assert.ok(source);
    const scope = nested ? "folder" : "result.txt";
    const leaf = nested ? "folder/result.txt" : scope;
    const plan = validateWorkflow({
      ...workflow,
      personas: {
        ...workflow.personas,
        reader: { description: "Reader", role: "Read", tools: [AgentTool.Read] },
      },
      steps: ["first", "second", "writer", "later", "peer"].map((id) => ({
        ...source,
        id,
        do: { ...source.do, persona: id === "writer" ? "worker" : "reader" },
        files: [id === "peer" ? "independent.txt" : id === "writer" ? scope : leaf],
      })),
    });
    const run = await new Engine(() => new FakeBackend()).create({
      project,
      plan,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "reader-order",
      submission_id: "reader-order",
    });
    const store = new RunStore(run.root);
    await store.read();
    const waiting = new Set<string>();
    const started: string[] = [];
    const readers = Promise.withResolvers<void>();
    const writer = Promise.withResolvers<void>();
    const controller = new AbortController();
    const files = new FileAccess(async (state, type, data) => {
      await store.commit(state, type, data);
      if (type === RunEventKind.FileAccessWaiting)
        waiting.add(FileAccessClaimSchema.shape.step_id.parse(ObjectSchema.parse(data).step_id));
    }, 4);
    const jobs: Promise<unknown>[] = [];
    const start = (index: number) => {
      const step = plan.nodes[index];
      assert.ok(step);
      const work = thrownBy(() =>
        files.use(
          run,
          step,
          step.id === "writer" ? controller.signal : new AbortController().signal,
          async () => {
            started.push(step.id);
            if (step.id === "first" || step.id === "second") await readers.promise;
            if (step.id === "writer") await writer.promise;
          },
        ),
      );
      jobs.push(work);
      return work;
    };
    try {
      const first = start(0);
      const second = start(1);
      assert.ok(await waitUntil(async () => started.length === 2));
      assert.deepEqual(started, ["first", "second"]);
      const pendingWriter = start(2);
      assert.ok(await waitUntil(async () => waiting.has("writer")));
      const later = start(3);
      assert.ok(await waitUntil(async () => waiting.has("later")));
      assert.equal(await start(4), undefined);
      assert.deepEqual(started, ["first", "second", "peer"]);
      if (cancel) {
        controller.abort();
        assert.ok(await pendingWriter);
        assert.equal(await later, undefined);
        assert.deepEqual(started, ["first", "second", "peer", "later"]);
      } else {
        readers.resolve();
        assert.ok(await waitUntil(async () => started.includes("writer")));
        assert.equal(started.includes("later"), false);
        writer.resolve();
        assert.equal(await pendingWriter, undefined);
        assert.equal(await later, undefined);
        assert.deepEqual(started, ["first", "second", "peer", "writer", "later"]);
      }
      readers.resolve();
      assert.equal(await first, undefined);
      assert.equal(await second, undefined);
      return true;
    } finally {
      readers.resolve();
      writer.resolve();
      await settle(jobs.map((job) => () => job));
    }
  });
}
