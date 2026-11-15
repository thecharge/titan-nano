import { strict as assert } from "node:assert";
import { chmod, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  ErrorCode,
  FileEncoding,
  IoLimit,
  RequestDecision,
  RequestKind,
  RunEventKind,
  StatementFixture,
  StatementLock,
  StatementTesting,
  TextSymbol,
  VerifyKind,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { Engine, StatementLocks } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type OperationRequest, type Run, StatementLockedSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { exists } from "@titan/workspace";
import { schemaFakeAnswer } from "../support/backend.ts";

function statementPlan(goal: boolean, path: string = StatementTesting.Path) {
  const base = vendorRecoveryWorkflow();
  const [first] = base.steps;
  assert.ok(first);
  const check = {
    kind: VerifyKind.Lean,
    statement: path,
    theorems: [StatementTesting.Theorem],
  } as const;
  return validateWorkflow({
    ...base,
    ...(goal ? { verify: [check] } : {}),
    steps: [{ ...first, id: StatementTesting.StepId, verify: goal ? [] : [check] }],
  });
}

async function lockRecord(run: Run) {
  const store = new RunStore(run.root);
  await store.read();
  for await (const event of store.events())
    if (event.type === RunEventKind.StatementLocked)
      return { store, record: StatementLockedSchema.parse(event.data) };
  return { store, record: undefined };
}

function pending(requests: OperationRequest[]): OperationRequest[] {
  return requests.filter((request) => request.kind === RequestKind.LockStatement);
}

export async function statementLocks(mode: StatementFixture) {
  return withTemporaryDirectory(async (project) => {
    const text =
      mode === StatementFixture.Long
        ? StatementTesting.LongUnit.repeat(StatementTesting.LongLength)
        : StatementTesting.Text;
    await mkdir(resolve(project, StatementTesting.Folder), { recursive: true });
    await writeFile(resolve(project, StatementTesting.Path), text);
    let started = StatementTesting.Starts;
    const engine = new Engine(
      () =>
        new FakeBackend(async (spec) => {
          started++;
          return schemaFakeAnswer(spec);
        }),
    );
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(project, StatementTesting.Home), project }),
      plan: statementPlan(mode === StatementFixture.Goal || mode === StatementFixture.ApprovedGoal),
      backend: Backend.Fake,
      client_id: StatementTesting.Client,
      submission_id: StatementTesting.Submission,
    });
    if (mode === StatementFixture.Linked) {
      await rm(resolve(project, StatementTesting.Path));
      await symlink(
        resolve(project, StatementTesting.Home),
        resolve(project, StatementTesting.Path),
      );
    }
    if (mode === StatementFixture.LinkedParent) {
      await rm(resolve(project, StatementTesting.Folder), { recursive: true });
      await symlink(
        resolve(project, StatementTesting.Home),
        resolve(project, StatementTesting.Folder),
      );
    }
    if (mode === StatementFixture.Oversized)
      await writeFile(resolve(project, StatementTesting.Path), "x".repeat(IoLimit.DataBytes + 1));
    if (mode === StatementFixture.Executable)
      await chmod(resolve(project, StatementTesting.Path), 0o755);
    await engine.start(run.run_id);
    const requests = pending(await engine.requests.list(run.run_id));
    if (
      mode === StatementFixture.Linked ||
      mode === StatementFixture.LinkedParent ||
      mode === StatementFixture.Oversized
    )
      return {
        started,
        requests: requests.length,
        step: run.nodes[StatementTesting.StepId]?.state,
      };
    const request = requests[0];
    assert.ok(request);
    const summary = () => ({
      started,
      run: run.state,
      step: run.nodes[StatementTesting.StepId]?.state,
      requests: requests.length,
      level: request.level,
      resource: request.scope.resource,
      textMatches: request.scope.arguments.slice(1).join(TextSymbol.Empty) === text,
      hashMatches: request.scope.content_hashes[StatementLock.HashKey] === hash(text),
    });
    if (
      mode === StatementFixture.Waiting ||
      mode === StatementFixture.Long ||
      mode === StatementFixture.Goal ||
      mode === StatementFixture.Executable
    )
      return summary();
    if (mode === StatementFixture.Twice) {
      await engine.resume(run.run_id);
      requests.splice(
        StatementLock.Start,
        requests.length,
        ...pending(await engine.requests.list(run.run_id)),
      );
      return summary();
    }
    const decide = (decision: RequestDecision, authority: ApprovalLevel, client: string) =>
      engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision,
          reason: StatementTesting.Reason,
        },
        { client_id: client, authority },
      );
    if (mode === StatementFixture.Lowered)
      return decide(RequestDecision.Approve, ApprovalLevel.Main, StatementTesting.Main);
    if (mode === StatementFixture.Repeated) {
      await decide(RequestDecision.Approve, ApprovalLevel.Human, StatementTesting.Person);
      return decide(RequestDecision.Deny, ApprovalLevel.Human, StatementTesting.Person);
    }
    const refusal = mode === StatementFixture.Denied || mode === StatementFixture.Edited;
    await decide(
      mode === StatementFixture.Denied ? RequestDecision.Deny : RequestDecision.Approve,
      ApprovalLevel.Human,
      StatementTesting.Person,
    );
    if (mode === StatementFixture.Edited)
      await writeFile(resolve(project, StatementTesting.Path), StatementTesting.Edit);
    if (mode === StatementFixture.LockedParent) {
      await symlink(
        resolve(project, StatementTesting.Folder),
        resolve(run.root, StatementLock.Directory),
      );
      try {
        await engine.resume(run.run_id);
      } catch (error) {
        assert.ok(error instanceof TitanError);
        assert.equal(error.code, ErrorCode.UnsafeSymlink);
      }
      assert.equal(started, 0);
      assert.deepEqual(await readdir(resolve(project, StatementTesting.Folder)), [
        "statement.lean",
      ]);
      return true;
    }
    await engine.resume(run.run_id);
    if (refusal)
      return {
        started,
        step: run.nodes[StatementTesting.StepId]?.state,
        locked: await exists(resolve(run.root, StatementLock.Directory)),
      };
    const { store, record } = await lockRecord(run);
    assert.ok(record);
    const copy = resolve(run.root, record.copy);
    if (mode === StatementFixture.Approved || mode === StatementFixture.ApprovedGoal)
      return {
        run: run.state,
        started: started > StatementTesting.Starts,
        copyMatches: (await readFile(copy, FileEncoding.Utf8)) === text,
        hashOnBoard: record.hash === hash(text),
        readOnly: ((await stat(copy)).mode & StatementTesting.ReadOnlyMask) === 0,
      };
    if (mode === StatementFixture.Changed) {
      await rm(copy);
      await writeFile(copy, StatementTesting.Edit);
    }
    if (mode === StatementFixture.Deleted) await rm(copy);
    if (mode === StatementFixture.ChangedLink) {
      await rm(copy);
      await symlink(resolve(project, StatementTesting.Path), copy);
    }
    const step = run.plan.nodes[StatementLock.Start];
    assert.ok(step);
    return new StatementLocks({
      ledger: () => engine.requests,
      events: () => store.events(),
      commit: (current, type, data) => store.commit(current, type, data),
    }).check(run, step);
  });
}

export async function statementAdmission(path: string, goal: boolean, linked = false) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const outside = resolve(root, "outside.lean");
    await mkdir(resolve(project, StatementTesting.Folder), { recursive: true });
    await writeFile(outside, StatementTesting.Text);
    await writeFile(resolve(project, StatementTesting.Path), StatementTesting.Text);
    if (linked) {
      await rm(resolve(project, StatementTesting.Path));
      await symlink(outside, resolve(project, StatementTesting.Path));
    }
    const engine = new Engine(() => new FakeBackend(schemaFakeAnswer));
    try {
      await engine.create({
        project,
        config: await resolveConfig({ home: root, project }),
        plan: statementPlan(goal, path === "absolute" ? outside : path),
        backend: Backend.Fake,
        client_id: StatementTesting.Client,
        submission_id: StatementTesting.Submission,
      });
      return true;
    } catch (error) {
      assert.equal(await exists(resolve(project, ".titan")), false);
      throw error;
    }
  });
}
