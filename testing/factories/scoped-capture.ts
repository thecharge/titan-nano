import { strict as assert } from "node:assert";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  ErrorCode,
  FileEncoding,
  LiveWorkspaceFixture as Fixture,
  PathPart,
  RequestDecision,
  RunEventKind,
  RunStatus,
  Verdict,
  WorkspaceModeSetting,
} from "@titan/constants";
import { settle } from "@titan/core";
import { liveCandidateConflict } from "@titan/messages";
import { Engine } from "@titan/runner";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { validateWorkflow } from "@titan/workflow";
import { exists, readTree, treeHash } from "@titan/workspace";

const survived = { verdict: Verdict.Survived, evidence: Fixture.Check };
const refuted = { verdict: Verdict.Refuted, evidence: Fixture.Evidence };

async function peerChurn(path: string, stop: Promise<void>, written: () => void) {
  let stopped = false;
  let writes = 1;
  void stop.then(() => {
    stopped = true;
  });
  do {
    await writeFile(path, String(writes++));
    written();
  } while (!stopped);
}

export function scopedCapture(nested: boolean, refute: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, Fixture.Project);
    const peerFolder = resolve(project, Fixture.Source);
    const peerMarker = resolve(peerFolder, Fixture.Second);
    const peerLink = resolve(peerFolder, Fixture.Third);
    const churnPath = resolve(peerFolder, Fixture.First);
    const existing = nested ? Fixture.Nested : Fixture.First;
    const target = resolve(project, existing);
    const sibling = resolve(project, Fixture.Folder, Fixture.Kept);
    const missing = resolve(project, Fixture.Third);
    await mkdir(peerFolder, { recursive: true });
    await mkdir(resolve(project, Fixture.Folder));
    await writeFile(target, Fixture.Old);
    if (nested) await writeFile(sibling, Fixture.Old);
    await writeFile(peerMarker, Fixture.Old);

    const config = await resolveConfig({
      home: resolve(root, Fixture.Home),
      project,
      overrides: {
        defaults: { max_attempts: Fixture.Attempts },
        recovery: { max_retries: 0 },
        workspace: { mode: WorkspaceModeSetting.Live },
      },
    });
    const prepared = Promise.withResolvers<void>();
    const reviewing = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let prepareWrites = 0;
    let rollbackWrites = 0;
    let prepareStart = 0;
    let rollbackStart = 0;
    let rollbackEnd = 0;
    let quiet = false;
    let reviewReady = false;
    let peerId = "";
    let targetTurns = 0;
    let reviewTurns = 0;

    async function runPeer() {
      await symlink(peerMarker, peerLink);
      await peerChurn(churnPath, prepared.promise, () => {
        prepareWrites++;
      });
      await rm(peerLink);
      quiet = true;
      await reviewing.promise;
      if (refute) await symlink(peerMarker, peerLink);
      await writeFile(peerMarker, Fixture.Person);
      if (refute) {
        await peerChurn(churnPath, release.promise, () => {
          rollbackWrites++;
          reviewReady = true;
        });
        await rm(peerLink);
      } else {
        reviewReady = true;
        await release.promise;
      }
      return { json: Fixture.Answer };
    }

    const engine = new Engine(
      () =>
        new FakeBackend(async (spec) => {
          assert.equal(spec.cwd, project);
          const claim = spec.file_scope?.claim;
          assert.ok(claim);
          assert.equal(claim.run_id, spec.run_id);
          if (spec.run_id === peerId) {
            assert.deepEqual(claim.paths, [peerFolder]);
            return spec.writable ? runPeer() : { json: survived };
          }
          if (spec.writable) {
            targetTurns++;
            assert.ok(prepareWrites > prepareStart, "Peer did not write during preparation");
            assert.equal(await exists(peerLink), true);
            prepared.resolve();
            assert.ok(
              await waitUntil(async () => quiet),
              "Peer did not pause for candidate capture",
            );
            await writeFile(target, Fixture.New);
            if (nested) await writeFile(sibling, Fixture.New);
            await writeFile(missing, Fixture.New);
            return { json: Fixture.Answer };
          }
          reviewTurns++;
          if (!refute) assert.equal(await readFile(peerMarker, FileEncoding.Utf8), Fixture.Old);
          reviewing.resolve();
          assert.ok(
            await waitUntil(async () => reviewReady),
            "Peer did not publish its review edit",
          );
          rollbackStart = rollbackWrites;
          return { json: refute ? refuted : survived };
        }),
      { max_active_agents: Fixture.Agents },
    );

    function create(id: string, files: string[]) {
      return engine.create({
        project,
        config,
        backend: Backend.Fake,
        client_id: Fixture.Client,
        submission_id: id,
        plan: validateWorkflow({
          name: Fixture.Name,
          goal: Fixture.Goal,
          personas: {
            [Fixture.Writer]: {
              description: Fixture.WriterDescription,
              role: Fixture.WriterRole,
              tools: [AgentTool.Write],
            },
            [Fixture.Skeptic]: {
              description: Fixture.SkepticDescription,
              role: Fixture.SkepticRole,
              tools: [AgentTool.Read],
            },
          },
          steps: [
            {
              id,
              files,
              do: { persona: Fixture.Writer, task: Fixture.Task },
              falsify: [{ persona: Fixture.Skeptic, task: Fixture.Check }],
            },
          ],
        }),
      });
    }

    const peer = await create(Fixture.StepTwo, [Fixture.Source]);
    peerId = peer.run_id;
    const run = await create(Fixture.StepOne, [
      ...(nested ? [Fixture.Folder, Fixture.Nested] : [Fixture.First]),
      Fixture.Third,
    ]);
    const peerWork = engine.start(peerId);
    let targetWork: Promise<void> | undefined;
    try {
      assert.ok(
        await waitUntil(async () => prepareWrites > 0),
        "Peer did not enter its admitted worker",
      );
      await assert.rejects(readTree(project), { code: ErrorCode.UnsafeSymlink });
      prepareStart = prepareWrites;
      let finished = false;
      targetWork = engine.start(run.run_id).finally(() => {
        rollbackEnd = rollbackWrites;
        finished = true;
      });
      void targetWork.catch(() => {});
      assert.ok(
        await waitUntil(async () => finished),
        "Target did not finish while peer held its claim",
      );
      await targetWork;
      const result = await engine.snapshot(run.run_id);
      const node = result.nodes[Fixture.StepOne];
      assert.ok(node?.input);
      const baseline = nested
        ? [existing, [Fixture.Folder, Fixture.Kept].join(PathPart.Separator)].sort()
        : [existing];
      assert.deepEqual(Object.keys(await readTree(node.input)).sort(), baseline);
      assert.equal(result.state, refute ? RunStatus.Failed : RunStatus.Blocked);
      assert.equal(node.refutations, refute ? 1 : 0);
      assert.equal(targetTurns, 1);
      assert.equal(reviewTurns, 1);
      assert.equal((await engine.snapshot(peerId)).state, RunStatus.Running);
      assert.equal(await readFile(peerMarker, FileEncoding.Utf8), Fixture.Person);
      assert.equal(await readFile(target, FileEncoding.Utf8), refute ? Fixture.Old : Fixture.New);
      if (nested)
        assert.equal(
          await readFile(sibling, FileEncoding.Utf8),
          refute ? Fixture.Old : Fixture.New,
        );
      assert.equal(await exists(missing), !refute);
      if (refute) {
        assert.ok(rollbackEnd > rollbackStart, "Peer did not write during rollback");
        await assert.rejects(readTree(project), { code: ErrorCode.UnsafeSymlink });
      } else {
        const { events } = await engine.events(run.run_id);
        assert.ok(
          events.some(
            (event) =>
              event.type === RunEventKind.StepBlocked &&
              Reflect.get(Object(event.data), "error") ===
                liveCandidateConflict([Fixture.Source, Fixture.Second].join(PathPart.Separator)),
          ),
        );
      }
    } finally {
      prepared.resolve();
      reviewing.resolve();
      release.resolve();
      await settle([() => peerWork, async () => targetWork]);
    }
    await peerWork;
    assert.equal((await engine.snapshot(peerId)).state, RunStatus.Passed);
    assert.equal(await readFile(peerMarker, FileEncoding.Utf8), Fixture.Person);
    return true;
  });
}

export function scopedRollbackConflict(parent: boolean, approved: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, Fixture.Project);
    const path = parent ? Fixture.Nested : Fixture.First;
    const target = resolve(project, path);
    const replaced = parent ? dirname(target) : target;
    const peer = resolve(project, Fixture.Second);
    const missing = resolve(project, Fixture.Third);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Fixture.Old);
    await writeFile(peer, Fixture.Old);
    const config = await resolveConfig({
      project,
      home: resolve(root, Fixture.Home),
      overrides: {
        workspace: { mode: WorkspaceModeSetting.Live },
        defaults: { max_attempts: Fixture.Attempts },
        recovery: { max_retries: 0 },
      },
    });
    let workers = 0;
    const engine = new Engine(
      () =>
        new FakeBackend(async (spec) => {
          if (spec.writable) {
            workers++;
            await rm(target);
            await writeFile(missing, Fixture.New);
            return { json: Fixture.Answer };
          }
          if (parent) await rm(replaced, { recursive: true });
          await writeFile(replaced, Fixture.Person);
          await symlink(peer, resolve(project, Fixture.Kept));
          return { json: refuted };
        }),
    );
    const run = await engine.create({
      project,
      config,
      backend: Backend.Fake,
      client_id: Fixture.Client,
      submission_id: Fixture.Submission,
      plan: validateWorkflow({
        name: Fixture.Name,
        goal: Fixture.Goal,
        personas: {
          [Fixture.Writer]: {
            description: Fixture.WriterDescription,
            role: Fixture.WriterRole,
            tools: [AgentTool.Write],
          },
          [Fixture.Skeptic]: {
            description: Fixture.SkepticDescription,
            role: Fixture.SkepticRole,
          },
        },
        steps: [
          {
            id: Fixture.StepOne,
            files: [path, Fixture.Third],
            do: { persona: Fixture.Writer, task: Fixture.Task },
            falsify: [{ persona: Fixture.Skeptic, task: Fixture.Check }],
          },
        ],
      }),
    });
    await engine.start(run.run_id);
    assert.equal(engine.get(run.run_id).state, RunStatus.Waiting);
    const request = (await engine.requests.list(run.run_id))[0];
    assert.ok(request);
    const current = await readTree(project, undefined, undefined, [], [path, Fixture.Third]);
    assert.equal(request.scope.content_hashes.current, await treeHash(current));
    assert.ok(Object.hasOwn(current, parent ? Fixture.Folder : Fixture.First));
    await engine.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: approved ? RequestDecision.Approve : RequestDecision.Deny,
        reason: Fixture.Check,
      },
      { client_id: Fixture.Client, authority: ApprovalLevel.Auto },
    );
    await engine.resume(run.run_id);
    assert.equal(workers, 1);
    return {
      state: engine.get(run.run_id).state,
      replacement: await readFile(replaced, FileEncoding.Utf8),
      created: await exists(missing),
      peer: await readFile(peer, FileEncoding.Utf8),
    };
  });
}
