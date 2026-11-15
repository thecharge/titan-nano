import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  BoardFile,
  ErrorCode,
  FileEncoding,
  IoLimit,
  Newline,
  RunEventKind,
  RunFormat,
  RunOriginMutation,
} from "@titan/constants";
import { hash } from "@titan/core";
import { Engine } from "@titan/runner";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type Run, RunEventSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createFakeBackend } from "../support/backend.ts";
import { legacyEngineRun } from "./legacy-run.ts";

function changeOrigin(run: Run, mutation: RunOriginMutation) {
  if (mutation === RunOriginMutation.Client) run.client_id = "changed-client";
  if (mutation === RunOriginMutation.Submission) run.submission_id = "changed-submission";
  if (mutation === RunOriginMutation.Session) {
    run.harness_session_id = "changed-session";
    run.schema_version = RunFormat.CallerSessions;
  }
  if (mutation === RunOriginMutation.Downgrade) {
    delete run.harness_session_id;
    run.schema_version = RunFormat.RequestTurns;
  }
}

export async function runOrigin(mutation: RunOriginMutation, journal: boolean, legacy = false) {
  async function observe(project: string) {
    const factory = () => createFakeBackend();
    const { engine, run } = await legacyEngineRun(factory, {
      project,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      plan: validateWorkflow(vendorRecoveryWorkflow()),
      backend: Backend.Fake,
      client_id: "origin-client",
      submission_id: "origin-submission",
      ...(legacy ? {} : { harness_session_id: "caller/α:42" }),
    });
    await engine.start(run.run_id);
    const store = new RunStore(run.root);
    const original = await store.read();
    const path = resolve(run.root, BoardFile.Journal);
    let bytes = await readFileBytes(path, IoLimit.ResponseBytes);
    const candidate = structuredClone(original);
    changeOrigin(candidate, mutation);
    const valid = mutation === RunOriginMutation.None;
    if (journal) {
      const lines = bytes.toString(FileEncoding.Utf8).trimEnd().split(Newline);
      const last = RunEventSchema.parse(JSON.parse(lines.at(-1) ?? ""));
      changeOrigin(last.state, mutation);
      lines[lines.length - 1] = JSON.stringify(last);
      bytes = Buffer.from(lines.join(Newline) + Newline);
      await writeFile(path, bytes);
    }
    if (!valid) {
      const failure = await thrownBy(() =>
        journal ? new RunStore(run.root).read() : store.commit(candidate, RunEventKind.Passed),
      );
      assert.ok(failure);
      assert.equal(Reflect.get(Object(failure), "code"), ErrorCode.CorruptBoard);
      assert.equal(hash(await readFileBytes(path, IoLimit.ResponseBytes)), hash(bytes));
      if (journal) {
        const replay = new Engine(factory);
        const failedLoad = await thrownBy(() => replay.load(run.root));
        assert.equal(Reflect.get(Object(failedLoad), "code"), ErrorCode.CorruptBoard);
        assert.equal(replay.has(run.run_id), false);
        const failedEvents = await thrownBy(async () => {
          for await (const event of new RunStore(run.root).events()) assert.ok(event.id);
        });
        assert.equal(Reflect.get(Object(failedEvents), "code"), ErrorCode.CorruptBoard);
      }
      if (!journal) {
        assert.deepEqual(await store.snapshot(), original);
        await store.commit(original, RunEventKind.Passed);
        const retained = await new RunStore(run.root).read();
        assert.equal(retained.version, original.version);
        assert.equal(retained.harness_session_id, legacy ? undefined : "caller/α:42");
      }
      return true;
    }
    if (!journal) await store.commit(candidate, RunEventKind.Passed);
    const recovered = await new RunStore(run.root).read();
    assert.equal(recovered.harness_session_id, original.harness_session_id);
    assert.equal(recovered.client_id, original.client_id);
    assert.equal(recovered.submission_id, original.submission_id);
    assert.equal(recovered.schema_version, original.schema_version);
    return true;
  }
  return withTemporaryDirectory(observe);
}
