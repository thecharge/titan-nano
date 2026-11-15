import { strict as assert } from "node:assert";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  ErrorCode,
  ExecutionPhase,
  FileEncoding,
  LiveWorkspaceFixture as Fixture,
  HandChange,
  PathPart,
  type RequestDecision,
  RunEventKind,
  RunFile,
  RunStatus,
  Verdict,
  WorkspaceModeSetting,
} from "@titan/constants";
import { settle } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { Engine } from "@titan/runner";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type FakeHandler, type LiveExecution, RunWrittenFilesSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { exists, git, putBack, readTree } from "@titan/workspace";

const personas = {
  [Fixture.Writer]: {
    description: Fixture.WriterDescription,
    role: Fixture.WriterRole,
    tools: [AgentTool.Write],
  },
  [Fixture.Skeptic]: { description: Fixture.SkepticDescription, role: Fixture.SkepticRole },
};

function step(id: string, files: readonly string[] | null) {
  return {
    id,
    do: { persona: Fixture.Writer, task: Fixture.Task },
    falsify: [{ persona: Fixture.Skeptic, task: Fixture.Check }],
    ...(files ? { files: [...files] } : {}),
  };
}

async function readText(path: string): Promise<string | null> {
  return (await exists(path)) ? readFile(path, FileEncoding.Utf8) : null;
}

async function execute(
  root: string,
  mode: WorkspaceModeSetting,
  steps: unknown[],
  handler: FakeHandler,
  after?: (engine: Engine, id: string) => Promise<void>,
  extraPersonas: Record<string, unknown> = {},
): Promise<LiveExecution> {
  const project = resolve(root, Fixture.Project);
  await mkdir(project);
  await writeFile(resolve(project, Fixture.First), Fixture.Old);
  const config = await resolveConfig({
    home: resolve(root, Fixture.Home),
    project,
    overrides: {
      workspace: { mode },
      defaults: { max_attempts: Fixture.Attempts },
      limits: { max_parallel: Fixture.Parallel },
    },
  });
  const plan = validateWorkflow({
    name: Fixture.Name,
    goal: Fixture.Goal,
    personas: { ...personas, ...extraPersonas },
    steps,
  });
  const engine = new Engine(() => new FakeBackend(handler), { max_active_agents: Fixture.Agents });
  const run = await engine.create({
    project,
    plan,
    config,
    backend: Backend.Fake,
    client_id: Fixture.Client,
    submission_id: Fixture.Submission,
  });
  await engine.start(run.run_id);
  await after?.(engine, run.run_id);
  return { project, run };
}

const survived = { verdict: Verdict.Survived, evidence: Fixture.Check };
const refuted = { verdict: Verdict.Refuted, evidence: Fixture.Evidence };

export async function liveWrite(mode: WorkspaceModeSetting, files: readonly string[] | null) {
  return withTemporaryDirectory(async (root) => {
    const { project, run } = await execute(
      root,
      mode,
      [step(Fixture.StepOne, files)],
      async (spec) => {
        if (!spec.writable) return { json: survived };
        await writeFile(resolve(spec.cwd, Fixture.First), Fixture.New);
        return { json: Fixture.Answer };
      },
    );
    return {
      text: await readText(resolve(project, Fixture.First)),
      changed: Object.keys(run.nodes[Fixture.StepOne]?.changes ?? {}),
      state: run.state,
    };
  });
}

export async function liveReview(mode: WorkspaceModeSetting, listed: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, Fixture.Project);
    let sameTree = false;
    let sharedMetadata = false;
    const { run } = await execute(
      root,
      mode,
      [step(Fixture.StepOne, listed ? [Fixture.First] : null)],
      async (spec) => {
        if (spec.writable) {
          if (mode === WorkspaceModeSetting.Live) {
            await git(project, ["init"]);
            await git(project, ["add", Fixture.First]);
            await git(project, [
              "-c",
              "user.name=Titan Test",
              "-c",
              "user.email=titan@example.invalid",
              "commit",
              "-m",
              "Initial review fixture",
            ]);
          }
          await mkdir(resolve(project, ".titan"), { recursive: true });
          await writeFile(resolve(project, ".titan/shared-sentinel"), Fixture.Person);
          await writeFile(resolve(spec.cwd, Fixture.First), Fixture.New);
          return { json: Fixture.Answer };
        }
        sameTree = spec.cwd === project;
        sharedMetadata = await exists(resolve(spec.cwd, ".titan/shared-sentinel"));
        assert.equal(await readText(resolve(spec.cwd, Fixture.First)), Fixture.New);
        return { json: survived };
      },
    );
    const folder = resolve(run.root, RunFile.Steps, Fixture.StepOne, `${RunFile.AttemptPrefix}1`);
    assert.equal(run.state, RunStatus.Passed);
    if (mode === WorkspaceModeSetting.Live) {
      assert.equal(await exists(resolve(project, ".git/worktrees")), false);
      assert.equal(await exists(resolve(folder, `${RunFile.ReviewPrefix}0`)), false);
    }
    assert.ok(
      await exists(resolve(folder, `${ExecutionPhase.FalsifierPrefix}0${RunFile.TaskSuffix}`)),
    );
    assert.equal(
      await exists(resolve(root, `${ExecutionPhase.FalsifierPrefix}0${RunFile.TaskSuffix}`)),
      false,
    );
    assert.equal(await readText(resolve(folder, RunFile.Candidate, Fixture.First)), Fixture.New);
    return { sameTree, sharedMetadata };
  });
}

export async function liveCheckContinuation(
  change: string | null,
  remove: boolean,
  unchanged = false,
) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, Fixture.Project);
    await mkdir(project);
    await writeFile(resolve(project, Fixture.First), Fixture.Old);
    await writeFile(resolve(project, Fixture.Second), Fixture.Old);
    let checks = 0;
    let workers = 0;
    let reconciliations = 0;
    let reviewers = 0;
    const factory = () =>
      new FakeBackend(async (spec, prompt) => {
        if (!spec.writable) {
          reviewers++;
          return { json: survived };
        }
        const recovery = JSON.parse(prompt).reconciliation;
        if (recovery) {
          reconciliations++;
          assert.deepEqual(recovery.original_result, Fixture.Answer);
          assert.equal(recovery.generation, 1);
          return { json: Fixture.Answer };
        }
        workers++;
        await writeFile(resolve(spec.cwd, Fixture.First), Fixture.New);
        return { json: Fixture.Answer };
      });
    const scripts = async () => {
      checks++;
      if (checks === 1) throw new OperationalError(ErrorCode.RequestWaiting, Fixture.Check);
      return { exit_code: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    };
    const config = await resolveConfig({ home: resolve(root, Fixture.Home), project });
    let engine = new Engine(factory, {}, { scripts });
    const run = await engine.create({
      project,
      config,
      plan: validateWorkflow({
        name: Fixture.Name,
        goal: Fixture.Goal,
        personas,
        steps: [{ ...step(Fixture.StepOne, [Fixture.First]), checks: [Fixture.Check] }],
      }),
      backend: Backend.Fake,
      client_id: Fixture.Client,
      submission_id: Fixture.Submission,
    });
    await engine.start(run.run_id);
    const first = await engine.snapshot(run.run_id);
    const original = first.nodes[Fixture.StepOne]?.phases.worker;
    assert.ok(original?.completed && original.candidate_hash);
    assert.equal(first.state, RunStatus.Waiting);
    if (change) {
      if (remove) await rm(resolve(project, change));
      else await writeFile(resolve(project, change), unchanged ? Fixture.Old : Fixture.Person);
    }
    engine = new Engine(factory, {}, { scripts });
    await engine.load(run.root);
    await engine.resume(run.run_id);
    const result = await engine.snapshot(run.run_id);
    const node = result.nodes[Fixture.StepOne];
    assert.ok(node);
    assert.equal(workers, 1);
    assert.equal(node.attempt, 1);
    assert.equal(node.refutations, 0);
    assert.deepEqual(node.evidence, []);
    if (change && !unchanged) {
      assert.equal(reconciliations, 1);
      assert.deepEqual(node.reconciliations?.[0]?.phases.worker, original);
      assert.equal(node.phases.worker?.executions, 1);
      assert.equal(node.phases[`${ExecutionPhase.FalsifierPrefix}0`]?.executions, 1);
    } else assert.equal(node.reconciliations, undefined);
    return {
      state: result.state,
      checks,
      reviewers,
      reconciliations,
      text: await readText(resolve(project, Fixture.First)),
    };
  });
}

export async function liveRecord(mode: WorkspaceModeSetting, count: number) {
  return withTemporaryDirectory(async (root) => {
    const names = [Fixture.First, Fixture.Second];
    let turn = 0;
    const { project } = await execute(
      root,
      mode,
      names.slice(0, count).map((_, index) => step(`${Fixture.StepOne}${index}`, null)),
      async (spec) => {
        if (!spec.writable) return { json: survived };
        await writeFile(resolve(spec.cwd, names[turn++] ?? Fixture.First), Fixture.New);
        return { json: Fixture.Answer };
      },
    );
    const record = resolve(project, HandChange.RunRecord);
    return (await exists(record))
      ? RunWrittenFilesSchema.parse(JSON.parse(await readFile(record, FileEncoding.Utf8)))
      : null;
  });
}

export async function liveRefute(mode: WorkspaceModeSetting, refute: boolean, edit: string | null) {
  return withTemporaryDirectory(async (root) => {
    const { project, run } = await execute(
      root,
      mode,
      [step(Fixture.StepOne, [Fixture.First, Fixture.Third])],
      async (spec) => {
        if (!spec.writable) return { json: refute ? refuted : survived };
        await writeFile(resolve(spec.cwd, Fixture.First), Fixture.New);
        await writeFile(resolve(spec.cwd, Fixture.Third), Fixture.New);
        if (edit) {
          await mkdir(dirname(resolve(spec.cwd, edit)), { recursive: true });
          await writeFile(resolve(spec.cwd, edit), Fixture.Person);
        }
        return { json: Fixture.Answer };
      },
    );
    const attempt = resolve(run.root, RunFile.Steps, Fixture.StepOne, `${RunFile.AttemptPrefix}1`);
    return {
      a: await readText(resolve(project, Fixture.First)),
      outside: edit ? await readText(resolve(project, edit)) : null,
      c: await readText(resolve(project, Fixture.Third)),
      kept: await readText(resolve(attempt, RunFile.Candidate, Fixture.First)),
      state: run.state,
    };
  });
}

export async function liveOverlap(
  first: readonly string[] | null,
  second: readonly string[] | null,
  firstWritable = true,
  secondWritable = true,
  checkerShell = false,
) {
  return withTemporaryDirectory(async (root) => {
    const inflight = new Set<string>();
    let peak = 0;
    const steps = [step(Fixture.StepOne, first), step(Fixture.StepTwo, second)].map(
      (entry, index) => ({
        ...entry,
        do: { ...entry.do, persona: index === 0 ? "first" : "second" },
      }),
    );
    const reader = { ...personas[Fixture.Writer], tools: [AgentTool.Read] };
    await execute(
      root,
      WorkspaceModeSetting.Live,
      [{ parallel: steps }],
      async (spec) => {
        const id = spec.invocation_id.split(PathPart.Separator)[0] ?? spec.invocation_id;
        if (spec.persona_id === Fixture.Skeptic) {
          inflight.delete(id);
          return { json: survived };
        }
        inflight.add(id);
        peak = Math.max(peak, inflight.size);
        await Bun.sleep(Fixture.HoldMilliseconds);
        return { json: Fixture.Answer };
      },
      undefined,
      {
        first: firstWritable ? personas[Fixture.Writer] : reader,
        second: secondWritable ? personas[Fixture.Writer] : reader,
        [Fixture.Skeptic]: {
          ...personas[Fixture.Skeptic],
          tools: checkerShell ? [AgentTool.Bash] : [],
        },
      },
    );
    return peak;
  });
}

export async function putBackPaths(restored: string, removed: string) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, Fixture.Source);
    const target = resolve(root, Fixture.Target);
    await mkdir(source);
    await mkdir(target);
    await writeFile(resolve(source, Fixture.Kept), Fixture.New);
    await writeFile(resolve(target, Fixture.First), Fixture.Old);
    const entry = (await readTree(source))[Fixture.Kept];
    assert.ok(entry);
    await putBack(target, { [restored]: entry }, [removed]);
    return Object.keys(await readTree(target)).sort();
  });
}

export async function liveConcurrent(
  path: string,
  workerRemoves: boolean,
  userRemoves: boolean,
  refute: boolean,
  decision: RequestDecision | null = null,
  changed = false,
) {
  return withTemporaryDirectory(async (root) => {
    const { project, run } = await execute(
      root,
      WorkspaceModeSetting.Live,
      [step(Fixture.StepOne, [path])],
      async (spec) => {
        if (spec.writable) {
          const target = resolve(spec.cwd, path);
          if (workerRemoves) await rm(target, { force: true });
          else await writeFile(target, Fixture.New);
          return { json: Fixture.Answer };
        }
        const target = resolve(root, Fixture.Project, path);
        if (userRemoves) await rm(target, { force: true });
        else await writeFile(target, Fixture.Person);
        return { json: refute ? refuted : survived };
      },
      decision === null
        ? undefined
        : async (engine, id) => {
            const request = (await engine.requests.list(id))[0];
            assert.ok(request);
            assert.equal(engine.get(id).state, RunStatus.Waiting);
            await engine.requests.answer(
              {
                run_id: id,
                request_id: request.request_id,
                version: request.version,
                decision,
                reason: Fixture.Check,
              },
              { client_id: Fixture.Client, authority: ApprovalLevel.Auto },
            );
            if (changed) await writeFile(resolve(root, Fixture.Project, path), Fixture.Old);
            await engine.resume(id);
          },
    );
    return { text: await readText(resolve(project, path)), state: run.state };
  });
}

export async function liveShared(first: string, second: string, cancel: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, Fixture.Project);
    await mkdir(project);
    await mkdir(resolve(project, Fixture.Folder));
    await writeFile(resolve(project, second), Fixture.Old);
    const config = await resolveConfig({ home: resolve(root, Fixture.Home), project });
    const held = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    let ownerId = "";
    let waitingId = "";
    let waitingStarts = 0;
    let readAfterYield: string | null = null;
    const engine: Engine = new Engine(
      () =>
        new FakeBackend(async (spec) => {
          const claim = spec.file_scope?.claim;
          assert.ok(claim);
          assert.equal(claim.run_id, spec.run_id);
          assert.equal(claim.step_id, Fixture.StepOne);
          assert.equal(claim.attempt, spec.attempt);
          assert.equal(claim.execution_id, spec.execution_id);
          const current = engine.get(spec.run_id).nodes[Fixture.StepOne];
          assert.deepEqual(current?.phases[claim.phase]?.file_claim, claim);
          assert.equal(spec.cwd, project);
          if (!spec.writable) return { json: survived };
          if (spec.run_id === ownerId) {
            entered.resolve();
            await held.promise;
            await writeFile(resolve(project, second), Fixture.New);
          }
          if (spec.run_id === waitingId) {
            waitingStarts++;
            readAfterYield = await readText(resolve(spec.cwd, second));
          }
          return { json: Fixture.Answer };
        }),
      { max_active_agents: 2 },
    );
    async function create(id: string, files: readonly string[]) {
      return engine.create({
        project,
        config,
        plan: validateWorkflow({
          name: id,
          goal: Fixture.Goal,
          personas,
          steps: [step(Fixture.StepOne, files)],
        }),
        backend: Backend.Fake,
        client_id: Fixture.Client,
        submission_id: id,
      });
    }
    const owner = await create(Fixture.StepOne, [first]);
    ownerId = owner.run_id;
    const waiting = await create(Fixture.StepTwo, [second]);
    waitingId = waiting.run_id;
    const peer = await create("peer", [Fixture.Second]);
    const ownerWork = engine.start(ownerId);
    await entered.promise;
    const waitingWork = engine.start(waitingId);
    const peerWork = engine.start(peer.run_id);
    try {
      assert.ok(
        await waitUntil(async () => {
          const page = await engine.events(waitingId);
          return page.events.some((event) => event.type === RunEventKind.FileAccessWaiting);
        }),
        "Overlapping access must publish its negotiation before dispatch",
      );
      assert.equal(waitingStarts, 0);
      await peerWork;
      assert.equal((await engine.snapshot(peer.run_id)).state, RunStatus.Passed);
      if (cancel) await engine.cancel(waitingId);
      held.resolve();
      await ownerWork;
      await peerWork;
      await waitingWork;
      const next = await create("later", [second]);
      await engine.start(next.run_id);
      const final = await engine.snapshot(waitingId);
      const events = (await engine.events(waitingId)).events.map((event) => event.type);
      assert.equal((await engine.snapshot(next.run_id)).state, RunStatus.Passed);
      assert.ok(
        events.includes(
          cancel ? RunEventKind.FileAccessWithdrawn : RunEventKind.FileAccessReleased,
        ),
      );
      return {
        state: final.state,
        starts: waitingStarts,
        readAfterYield,
        attempts: final.nodes[Fixture.StepOne]?.attempt,
        refutations: final.nodes[Fixture.StepOne]?.refutations,
        peer: (await engine.snapshot(peer.run_id)).state,
      };
    } finally {
      held.resolve();
      await settle([() => ownerWork, () => waitingWork, () => peerWork]);
    }
  });
}
