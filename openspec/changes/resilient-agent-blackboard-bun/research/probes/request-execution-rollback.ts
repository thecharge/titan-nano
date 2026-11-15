import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  BoardFile,
  ExecutionPhase,
  IoLimit,
  RunFormat,
  RunStatus,
  RequestKind,
  ErrorCode,
  Verdict,
} from "@titan/constants";
import { hash } from "@titan/core";
import { call, readAddress, startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "../../../../../testing/packages/factories/src/index.ts";
import { thrownBy, waitUntil } from "../../../../../testing/packages/framework/src/index.ts";
import { withTemporaryDirectory } from "../../../../../testing/packages/framework/src/files.ts";
import { RunSchema } from "@titan/types";

const previous = process.argv[2];
assert.ok(previous);
for (const checker of [false, true]) {
  await withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const release = Promise.withResolvers<void>();
    let entered = false;
    const key = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
    const backend = new FakeBackend(async (spec) => {
      if (!entered && spec.invocation_id.endsWith(`/${key}`)) {
        entered = true;
        await release.promise;
      }
      return {
        json: spec.invocation_id.endsWith(`/${ExecutionPhase.Worker}`)
          ? { ok: true, marker: "candidate", turn: 1 }
          : { verdict: Verdict.Survived, evidence: "Checked candidate" },
      };
    });
    const current = await startServer(home, () => backend);
    let stopped = false;
    try {
      const runs = createRunClient(home);
      const run = RunSchema.parse(
        await runs.submit({
          project,
          workflow: vendorRecoveryWorkflow(),
          backend: Backend.Fake,
          client_id: "rollback-client",
          submission_id: "upgraded",
        }),
      );
      assert.ok(await waitUntil(async () => entered));
      const active = RunSchema.parse(await runs.get(run.run_id));
      const phase = active.nodes.deliver?.phases[key];
      assert.ok(phase?.session_id && phase.execution_id);
      await createRequestClient(home).open(run.run_id, {
        request_id: "bound-request",
        kind: RequestKind.Tool,
        scope: {
          operation: "inspect",
          resource: "candidate",
          content_hashes: {},
          arguments: [],
          environment_names: [],
        },
        origin: {
          client_id: active.client_id,
          harness_session_id: phase.session_id,
          execution: {
            step_id: "deliver",
            attempt: 1,
            phase: key,
            execution_id: phase.execution_id,
          },
        },
        expires_at: Date.now() + 60000,
      });
      release.resolve();
      assert.ok(
        await waitUntil(
          async () => RunSchema.parse(await runs.get(run.run_id)).state === RunStatus.Passed,
        ),
      );
      assert.equal(
        RunSchema.parse(await runs.get(run.run_id)).schema_version,
        RunFormat.ExecutionRequests,
      );
      const legacy = RunSchema.parse(
        await runs.submit({
          project,
          workflow: vendorRecoveryWorkflow(),
          backend: Backend.Fake,
          client_id: "rollback-client",
          submission_id: "legacy",
        }),
      );
      assert.ok(
        await waitUntil(
          async () => RunSchema.parse(await runs.get(legacy.run_id)).state === RunStatus.Passed,
        ),
      );
      await current.stop();
      stopped = true;
      const journal = resolve(run.root, BoardFile.Journal);
      const before = hash(await readFileBytes(journal, IoLimit.ResponseBytes));
      const child = Bun.spawn([process.execPath, previous, "serve", "--home", home, "--json"], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "inherit",
        timeout: 10000,
      });
      try {
        assert.ok(
          await waitUntil(async () => {
            try {
              return (
                (await readAddress(home)).pid === child.pid &&
                Reflect.get(Object(await call(home, "/health")), "ready") === true
              );
            } catch {
              return false;
            }
          }, 300),
        );
        for (const action of ["", "/resume"]) {
          const failure = await thrownBy(() =>
            call(home, `/runs/${run.run_id}${action}`, action ? "POST" : "GET"),
          );
          assert.ok(failure);
          assert.equal(Reflect.get(Object(failure), "code"), ErrorCode.CorruptBoard);
          assert.equal(hash(await readFileBytes(journal, IoLimit.ResponseBytes)), before);
        }
        const retained = RunSchema.parse(await call(home, `/runs/${legacy.run_id}`));
        assert.equal(retained.schema_version, RunFormat.Legacy);
        assert.equal(retained.state, RunStatus.Passed);
        console.log(
          JSON.stringify({
            phase: key,
            previous_refused_inspection: true,
            previous_refused_resume: true,
            upgraded_journal_unchanged: true,
            legacy_readable: true,
          }),
        );
      } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
        await child.exited;
      }
    } finally {
      release.resolve();
      if (!stopped) await current.stop();
    }
  });
}
