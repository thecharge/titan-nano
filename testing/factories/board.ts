import { strict as assert } from "node:assert";
import { appendFile, lstat, mkdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initialPhase, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardFile,
  BoardFixture,
  BoardLimit,
  ErrorCode,
  EventLogFixture,
  ExecutionPhase,
  Newline,
  RunFile,
  RunFormat,
  RunStatus,
  SnapshotReadFixture,
} from "@titan/constants";
import { all, hash } from "@titan/core";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunEventSchema, type RunSchemaVersion } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";

export async function boardRecord(mode: string) {
  return withTemporaryDirectory(async (project) => {
    const workflow = vendorRecoveryWorkflow();
    const run = await new Engine(createFakeBackend).create({
      project,
      plan: validateWorkflow(workflow),
      ...(mode.includes("persona-reference")
        ? {
            persona_references: Object.fromEntries(
              Object.keys(workflow.personas).map((name) => [name, `${name}@1`]),
            ),
          }
        : {}),
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "record-validation",
      submission_id: "record-validation",
    });
    const store = new RunStore(run.root);
    await store.read();
    const node = run.nodes.deliver;
    assert.ok(node);
    const phase = initialPhase();
    node.phases[mode === "checker" ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker] =
      phase;
    if (mode.includes("persona-source")) {
      run.schema_version =
        mode === "old-persona-source" ? RunFormat.WriteClaims : RunFormat.PersonaBindings;
      run.source_plan = structuredClone(run.plan);
      if (mode === "persona-source-binding") {
        const worker = Object.keys(run.plan.workflow.personas)[0];
        assert.ok(worker);
        run.plan = validateWorkflow({
          ...run.plan.workflow,
          personas: {
            ...run.plan.workflow.personas,
            [worker]: { description: "Changed", role: "Changed inline role" },
          },
        });
      }
      if (mode === "persona-source-extra")
        run.plan = validateWorkflow({
          ...run.plan.workflow,
          personas: {
            ...run.plan.workflow.personas,
            another: { description: "Another", role: "Another role" },
          },
        });
      if (mode === "persona-source-unresolved") {
        run.source_plan = validateWorkflow({
          ...run.source_plan.workflow,
          personas: {
            ...run.source_plan.workflow.personas,
            another: { description: "Another", role: "Another role" },
          },
        });
        run.workflow_revision = run.source_plan.revision;
        run.plan = validateWorkflow({
          ...run.plan.workflow,
          personas: {
            ...run.plan.workflow.personas,
            another: { use: "another@1" },
          },
        });
      }
      if (mode === "changed-persona-source") run.source_plan.workflow.goal = "Changed source goal";
    }
    if (mode === "persona-format") run.schema_version = RunFormat.PersonaBindings;
    if (mode.includes("persona-reference")) {
      run.schema_version =
        mode === "old-persona-reference" ? RunFormat.WriteClaims : RunFormat.PersonaBindings;
      run.persona_references = Object.fromEntries(
        Object.keys(run.plan.workflow.personas).map((name) => [name, `${name}@1`]),
      );
      const name = Object.keys(run.persona_references)[0];
      assert.ok(name);
      if (mode === "missing-persona-reference") delete run.persona_references[name];
      if (mode === "wrong-persona-reference") run.persona_references[name] = "another@1";
      if (mode === "zero-persona-reference") run.persona_references[name] = `${name}@0`;
      if (mode === "changed-persona-reference") run.persona_references[name] = `${name}@2`;
      if (mode === "removed-persona-reference") delete run.persona_references;
      if (mode === "reordered-persona-reference")
        run.persona_references = Object.fromEntries(
          Object.entries(run.persona_references ?? {}).reverse(),
        );
    }
    if (mode === "missing-node") delete run.nodes.deliver;
    if (mode === "extra-node") run.nodes.extra = structuredClone(node);
    if (mode === "old-reads") {
      run.schema_version = RunFormat.FileObservations;
      node.read_paths = ["dependency.txt"];
    }
    if (mode === "old-observations") {
      run.schema_version = RunFormat.CaptureReceipts;
      phase.file_reads = [];
    }
    if (mode === "old-receipt") {
      run.schema_version = RunFormat.PinnedRuntime;
      phase.capture_pending = true;
    }
    if (mode === "outside-workspace") node.input = resolve(project, "outside");
    if (mode === "parent-workspace") node.input = `${run.root}/steps/../outside`;
    if (mode.includes("reconciliation")) {
      run.schema_version =
        mode === "old-reconciliation" ? RunFormat.ReadClaims : RunFormat.Reconciliation;
      node.reconciliations = [
        {
          input: resolve(
            run.root,
            RunFile.Steps,
            "deliver",
            `${RunFile.AttemptPrefix}1`,
            `${RunFile.ReconciliationPrefix}1`,
            RunFile.Input,
          ),
          input_hash: hash("current input"),
          phases: { worker: { ...initialPhase(), capture_pending: true } },
        },
      ];
      const generation = node.reconciliations[0];
      assert.ok(generation);
      if (mode === "outside-reconciliation") generation.input = resolve(project, "outside");
      if (mode === "crossed-reconciliation")
        generation.input = generation.input.replace("deliver", "another");
      if (mode === "completed-reconciliation" || mode === "completed-unsealed-reconciliation")
        generation.phases.worker = {
          ...initialPhase(),
          completed: true,
          ...(mode === "completed-reconciliation" ? { candidate_hash: hash("candidate") } : {}),
        };
      if (mode === "empty-reconciliation") generation.phases.worker = initialPhase();
      if (mode === "checker-reconciliation")
        generation.phases[`${ExecutionPhase.FalsifierPrefix}0`] = {
          ...initialPhase(),
          capture_pending: true,
        };
    }
    await store.commit(run, "record-validation");
    if (mode === "replayed-persona-reference") {
      const path = resolve(run.root, BoardFile.Journal);
      const lines = (await readFileBytes(path, BoardLimit.RecordBytes))
        .toString()
        .trimEnd()
        .split(Newline);
      const last = lines.pop();
      assert.ok(last);
      const event = RunEventSchema.parse(JSON.parse(last));
      const name = Object.keys(event.state.persona_references ?? {})[0];
      assert.ok(name && event.state.persona_references);
      event.state.persona_references[name] = `${name}@2`;
      await writeFile(path, [...lines, JSON.stringify(event)].join(Newline) + Newline);
    }
    assert.deepEqual((await new RunStore(run.root).read()).nodes, run.nodes);
    return true;
  });
}

export async function boardValidation(configuration: boolean, valid: boolean) {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(() => createFakeBackend());
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "validation",
      submission_id: "cache",
    });
    const store = new RunStore(run.root);
    await store.read();
    const original = structuredClone(run);
    if (configuration) {
      run.config.value.limits.max_parallel++;
      if (valid) run.config.hash = hash(JSON.stringify(run.config.value));
    } else {
      run.plan = validateWorkflow({ ...run.plan.workflow, goal: "Validate changed plan" });
      if (valid) run.workflow_revision = run.plan.revision;
    }
    if (valid) {
      await store.commit(run, "changed-validation");
      await store.commit(run, "reused-validation");
      assert.deepEqual(await store.read(), await store.snapshot());
      return true;
    }
    await assert.rejects(async () => store.commit(run, "invalid-validation"), {
      code: ErrorCode.CorruptBoard,
    });
    assert.equal((await store.snapshot()).version, 1);
    await store.commit(original, "after-refusal");
    assert.equal((await store.snapshot()).version, 2);
    const corrupt = {
      id: 3,
      time: Date.now(),
      type: "invalid-validation",
      data: null,
      state: { ...run, version: 3 },
    };
    await appendFile(
      resolve(run.root, BoardFile.Journal),
      Buffer.from(`${JSON.stringify(corrupt)}\n`),
    );
    await assert.rejects(() => store.read(), { code: ErrorCode.CorruptBoard });
    await assert.rejects(
      async () => {
        for await (const _event of store.events());
      },
      { code: ErrorCode.CorruptBoard },
    );
    return true;
  });
}

export async function replayBoard(mode: BoardFixture): Promise<unknown> {
  return withTemporaryDirectory(async (directory) => {
    const project = resolve(directory, "project");
    await mkdir(project);
    const config = await resolveConfig({ home: resolve(directory, "home"), project });
    const personas = {
      writer: { description: "Writes", role: "Solve" },
      checker: { description: "Checks", role: "Refute" },
    };
    const step = {
      id: "a",
      do: { persona: "writer", task: "Solve" },
      falsify: [{ persona: "checker", task: "Refute" }],
    };
    const plan = validateWorkflow({
      name: "Board fixture",
      goal: "Retain ordering and recovery",
      personas,
      steps: [step],
    });
    const engine = new Engine(() => createFakeBackend());
    const run = await engine.create({
      project,
      plan,
      config,
      backend: Backend.Fake,
      client_id: "fixture",
      submission_id: "fixture",
    });
    const store = new RunStore(run.root);
    await store.read();
    await all(
      Array.from(
        { length: 6 },
        (_, index) => async () => store.commit(run, "fixture_event", { index }),
      ),
      2,
    );
    const path = resolve(run.root, BoardFile.Journal);
    if (mode === BoardFixture.TrailingWrite) await appendFile(path, Buffer.from('{"id":8'));
    if (mode === BoardFixture.InvalidJson) await appendFile(path, Buffer.from("invalid\n"));
    if (mode === BoardFixture.DuplicateSequence) {
      const text = (await readFileBytes(path, BoardLimit.RecordBytes)).toString();
      await appendFile(path, Buffer.from(`${text.split("\n")[0]}\n`));
    }
    if (mode === BoardFixture.InvalidUsage) {
      const event = RunEventSchema.parse(
        JSON.parse(
          (await readFileBytes(path, BoardLimit.RecordBytes)).toString().split("\n")[0] ?? "",
        ),
      );
      event.id = 8;
      event.state.version = 8;
      const node = event.state.nodes.a;
      assert.ok(node);
      node.phases.worker = {
        ...initialPhase(),
        usage: [{ input_tokens: -1, output_tokens: 0, cost_usd: null }],
      };
      await appendFile(path, Buffer.from(`${JSON.stringify(event)}\n`));
    }
    const recovered = await store.read();
    await store.commit(recovered, "after_recovery");
    const ids: number[] = [];
    for await (const event of store.events(mode === BoardFixture.Cutoff ? 4 : undefined))
      ids.push(event.id);
    return { ids, version: recovered.version };
  });
}

export async function durableSnapshot(mode: SnapshotReadFixture) {
  return withTemporaryDirectory(async (directory) => {
    if (mode === SnapshotReadFixture.Empty) return new RunStore(directory).snapshot();
    const project = resolve(directory, "project");
    await mkdir(project);
    const engine = new Engine(() => createFakeBackend());
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(directory, "home"), project }),
      backend: Backend.Fake,
      client_id: "snapshot",
      submission_id: "one",
    });
    const store = new RunStore(run.root);
    const loaded = await store.read();
    loaded.state = RunStatus.Passed;
    assert.equal((await store.snapshot()).state, RunStatus.Running);
    if (mode === SnapshotReadFixture.AppendFailure) {
      const path = resolve(run.root, BoardFile.Journal);
      await rename(path, `${path}.saved`);
      await mkdir(path);
    }
    if (mode === SnapshotReadFixture.ProjectionFailure) {
      const path = resolve(run.root, BoardFile.State);
      await rm(path);
      await mkdir(path);
    }
    const writing = store.commit(loaded, "snapshot-fixture");
    const [failure, observed] = await all([
      () => thrownBy(async () => writing),
      () =>
        thrownBy(async () => {
          assert.equal((await store.snapshot()).state, RunStatus.Passed);
        }),
    ]);
    if (mode === SnapshotReadFixture.ProjectionFailure) {
      const recovered = new RunStore(run.root);
      await recovered.read();
      assert.equal((await recovered.snapshot()).state, RunStatus.Passed);
    }
    if (
      mode === SnapshotReadFixture.AppendFailure ||
      mode === SnapshotReadFixture.ProjectionFailure
    ) {
      assert.ok(failure);
      assert.equal(observed, failure);
      throw failure;
    }
    assert.equal(failure, undefined);
    assert.equal(observed, undefined);
    const source = mode === SnapshotReadFixture.Reload ? new RunStore(run.root) : store;
    if (mode === SnapshotReadFixture.Reload) {
      const mutable = await source.read();
      mutable.state = RunStatus.Cancelled;
    }
    const snapshot = await source.snapshot();
    snapshot.state = RunStatus.Cancelled;
    assert.equal((await source.snapshot()).state, RunStatus.Passed);
    const durable = await source.snapshot();
    return { state: durable.state, version: durable.version };
  });
}

export async function durableEventLog(mode: EventLogFixture) {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(() => createFakeBackend());
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "event-log",
      submission_id: "one",
    });
    const journal = resolve(run.root, BoardFile.Journal);
    const events = resolve(run.root, BoardFile.Events);
    let store = new RunStore(run.root);
    if (mode === EventLogFixture.Legacy) await rm(events, { force: true });
    await store.read();
    if (mode !== EventLogFixture.Created && mode !== EventLogFixture.Legacy) {
      await replaceEventLog(events, mode);
      await assert.rejects(() => store.commit(run, "replacement"), {
        code: ErrorCode.CorruptBoard,
      });
      await assert.rejects(() => store.snapshot(), { code: ErrorCode.CorruptBoard });
      await rm(events, { recursive: mode === EventLogFixture.Directory });
      await assert.rejects(() => store.snapshot(), { code: ErrorCode.CorruptBoard });
      store = new RunStore(run.root);
      assert.equal((await store.read()).version, 2);
    }
    await store.commit(await store.snapshot(), "after-recovery");
    const primary = await lstat(journal);
    const view = await lstat(events);
    assert.equal(primary.isFile() && view.isFile(), true);
    assert.equal(view.dev, primary.dev);
    assert.equal(view.ino, primary.ino);
    assert.equal(view.mode & 0o777, 0o600);
    assert.deepEqual(
      await readFileBytes(events, BoardLimit.RecordBytes),
      await readFileBytes(journal, BoardLimit.RecordBytes),
    );
    return true;
  });
}

async function replaceEventLog(path: string, mode: EventLogFixture): Promise<void> {
  await rm(path, { force: true });
  if (mode === EventLogFixture.Directory) await mkdir(path);
  else if (mode === EventLogFixture.Symbolic) await symlink(BoardFile.Journal, path);
  else await writeFile(path, Buffer.from("Unrelated event log\n"));
}

export async function receiptRecord(
  version: RunSchemaVersion,
  worker: boolean,
  pending: boolean,
  completed: boolean,
  valid: boolean,
) {
  return withTemporaryDirectory(async (project) => {
    const engine = new Engine(createFakeBackend);
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "receipt",
      submission_id: "receipt",
    });
    const store = new RunStore(run.root);
    await store.read();
    const node = run.nodes.deliver;
    assert.ok(node);
    run.schema_version = version;
    node.phases[worker ? ExecutionPhase.Worker : `${ExecutionPhase.FalsifierPrefix}0`] = {
      ...initialPhase(),
      completed,
      ...(pending ? { capture_pending: true } : {}),
    };
    const failure = await thrownBy(() => store.commit(run, "receipt-fixture"));
    if (!valid) {
      assert.ok(failure);
      assert.equal(Reflect.get(Object(failure), "code"), ErrorCode.CorruptBoard);
      return true;
    }
    assert.equal(failure, undefined);
    assert.deepEqual((await new RunStore(run.root).read()).nodes, run.nodes);
    return true;
  });
}

export async function inspectBoard(partial: boolean, missing: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    if (missing) {
      const root = partial ? resolve(project, "missing") : project;
      const error = await thrownBy(() => new RunStore(root).inspect());
      assert.ok(error instanceof Error && "code" in error && error.code === ErrorCode.RunNotFound);
      return true;
    }
    const engine = new Engine(() => createFakeBackend());
    const run = await engine.create({
      project,
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      backend: Backend.Fake,
      client_id: "inspection",
      submission_id: "one",
    });
    const path = resolve(run.root, BoardFile.Journal);
    if (partial) await appendFile(path, "{unfinished");
    const before = await readFileBytes(path, BoardLimit.RecordBytes);
    await rm(resolve(run.root, BoardFile.Events));
    assert.equal((await new RunStore(run.root).inspect()).run_id, run.run_id);
    assert.deepEqual(await readFileBytes(path, BoardLimit.RecordBytes), before);
    await assert.rejects(() => lstat(resolve(run.root, BoardFile.Events)), { code: "ENOENT" });
    return true;
  });
}
