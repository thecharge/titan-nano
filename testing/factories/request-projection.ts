import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  IoLimit,
  RequestDecision,
  RequestKind,
  RequestLimit,
  RequestProjection,
  RequestProjectionFixture,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { Run } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { projectionMatches } from "../support/request-projection.ts";

async function assertFenced(engine: Engine, run: Run): Promise<void> {
  assert.ok(await thrownBy(() => engine.snapshot(run.run_id)));
  assert.ok(await thrownBy(() => engine.requests.list(run.run_id)));
  const store = new RunStore(run.root);
  const durable = await store.read();
  assert.ok(await thrownBy(() => engine.cancel(run.run_id)));
  assert.equal((await store.read()).version, durable.version);
}

export async function requestProjection(mode: RequestProjectionFixture) {
  return withTemporaryDirectory(async (project) => {
    const factory = () => createFakeBackend();
    const engine = new Engine(factory);
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      backend: Backend.Fake,
      client_id: "projection-client",
      submission_id: "projection-submission",
    });
    const path = resolve(run.root, RequestProjection.File);
    await projectionMatches(run, [], run.version);
    const input = {
      request_id: "first-request",
      kind: RequestKind.Tool,
      scope: {
        operation: "inspect",
        resource: "candidate",
        content_hashes: {},
        arguments: Array.from({ length: 8 }, () => "\n".repeat(RequestLimit.TextCharacters)),
        environment_names: [],
      },
      origin: { client_id: run.client_id, harness_session_id: null },
      expires_at: Date.now() + 60000,
    };
    if (mode === RequestProjectionFixture.OpenFailure) {
      await rm(path);
      await mkdir(path);
      const failure = await thrownBy(() => engine.requests.open(run.run_id, input));
      assert.ok(failure);
      await assertFenced(engine, run);
      await rm(path, { recursive: true });
      const recovered = new Engine(factory);
      await recovered.load(run.root);
      const requests = await recovered.requests.list(run.run_id);
      assert.equal(requests.length, 1);
      await projectionMatches(run, requests);
      const before = (await recovered.snapshot(run.run_id)).version;
      assert.deepEqual(await recovered.requests.open(run.run_id, input), requests[0]);
      assert.equal((await recovered.snapshot(run.run_id)).version, before);
      throw failure;
    }
    const first = await engine.requests.open(run.run_id, input);
    assert.ok((await projectionMatches(run, [first], run.version)).byteLength > IoLimit.ChunkBytes);
    const second = await engine.requests.open(run.run_id, {
      ...input,
      request_id: "second-request",
    });
    await projectionMatches(run, [first, second], run.version);
    const answering = () =>
      engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: first.request_id,
          version: first.version,
          decision:
            mode === RequestProjectionFixture.Deny ? RequestDecision.Deny : RequestDecision.Approve,
          reason: "Reviewed exact candidate",
        },
        { client_id: "reviewer", authority: ApprovalLevel.Main },
      );
    if (mode === RequestProjectionFixture.AnswerFailure) {
      await rm(path);
      await mkdir(path);
      const failure = await thrownBy(answering);
      assert.ok(failure);
      await assertFenced(engine, run);
      await rm(path, { recursive: true });
      const recovered = new Engine(factory);
      await recovered.load(run.root);
      const requests = await recovered.requests.list(run.run_id);
      assert.equal(requests.length, 2);
      assert.equal(requests[0]?.answer?.decision, RequestDecision.Approve);
      await projectionMatches(run, [second]);
      throw failure;
    }
    await answering();
    await projectionMatches(run, [second], run.version);
    const escalated = await engine.requests.escalate(
      {
        run_id: run.run_id,
        request_id: second.request_id,
        version: second.version,
        reason: "Person review required",
      },
      { client_id: "main-agent", authority: ApprovalLevel.Main },
    );
    await projectionMatches(run, [escalated], run.version);
    if (mode === RequestProjectionFixture.Missing) await rm(path);
    else if (mode === RequestProjectionFixture.RepairFailure) {
      await rm(path);
      await mkdir(path);
    } else if (mode === RequestProjectionFixture.Stale)
      await writeFile(
        path,
        Buffer.from(
          JSON.stringify({
            schema_version: RequestProjection.Version,
            run_id: "foreign-run",
            through: 0,
            requests: [],
          }),
        ),
      );
    else await writeFile(path, Buffer.from("malformed stale projection"));
    const recovered = new Engine(factory);
    if (mode === RequestProjectionFixture.RepairFailure) {
      const failure = await thrownBy(() => recovered.load(run.root));
      assert.ok(failure);
      assert.equal(recovered.has(run.run_id), false);
      await rm(path, { recursive: true });
      await recovered.load(run.root);
      await projectionMatches(run, [escalated]);
      throw failure;
    }
    await recovered.load(run.root);
    await projectionMatches(run, [escalated]);
    assert.deepEqual(
      await recovered.requests.list(run.run_id),
      await engine.requests.list(run.run_id),
    );
    const store = new RunStore(run.root);
    const committed = await store.read();
    const cursor = committed.version;
    await recovered.requests.answer(
      {
        run_id: run.run_id,
        request_id: escalated.request_id,
        version: escalated.version,
        decision: RequestDecision.Deny,
        reason: "Person declined",
      },
      { client_id: "person", authority: ApprovalLevel.Human },
    );
    await projectionMatches(run, [], cursor + 1);
    return true;
  });
}
