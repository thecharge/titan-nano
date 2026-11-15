import { strict as assert } from "node:assert";
import { readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { inspectArtifacts } from "@titan/artifacts";
import { FakeBackend } from "@titan/backend-fake";
import { collectProofReport, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  CommandCaptureLimit,
  FileEncoding,
  ProofAnswer,
  RunArtifactFile,
  RunEventKind,
  StepStatus,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ScriptProofReportSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function proofReportIntegrity(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const engine = new Engine(
      () => new FakeBackend(async () => ({ json: {} })),
      {},
      {
        scripts: async (script) => ({
          exit_code: 0,
          stdout:
            mode === "large" && script === "proof"
              ? Buffer.alloc(CommandCaptureLimit.Bytes, 255)
              : mode === "binary"
                ? Buffer.from([0, 255, 195, 40])
                : Buffer.from("checked"),
          stderr:
            mode === "large" && script === "proof"
              ? Buffer.alloc(CommandCaptureLimit.Bytes, 128)
              : mode === "binary"
                ? Buffer.from([128, 254])
                : Buffer.alloc(0),
        }),
      },
    );
    const run = await engine.create({
      project: root,
      config: await resolveConfig({ home: resolve(root, "home"), project: root }),
      plan: validateWorkflow({
        name: "Recorded proof",
        goal: "Preserve checked answers and their complete output",
        personas: {},
        steps: [
          {
            id: "deliver",
            do: { script: "worker" },
            verify: [{ kind: "script", run: "proof", deterministic: true }],
            falsify: [{ script: "review" }],
          },
        ],
      }),
      backend: Backend.Fake,
      client_id: "proof-report-owner",
      submission_id: "proof-report-run",
    });
    await engine.start(run.run_id);
    const finished = await engine.snapshot(run.run_id);
    const path = resolve(run.root, RunArtifactFile.Proofs);
    const report = ScriptProofReportSchema.parse(
      JSON.parse(await readFile(path, FileEncoding.Utf8)),
    );
    assert.equal(report.checks.length, 1);
    const capture = report.checks[0];
    assert(capture);
    if (mode === "binary" || mode === "large") {
      const output = JSON.parse(
        await readFile(resolve(run.root, capture.output), FileEncoding.Utf8),
      );
      for (const invocation of output.captures) {
        assert(invocation.capture);
        assert.equal(invocation.stdout, "");
        assert.equal(invocation.stderr, "");
        const retained = JSON.parse(
          await readFile(resolve(run.root, invocation.capture.path), FileEncoding.Utf8),
        );
        assert.deepEqual(
          Buffer.from(retained.stdout_base64, FileEncoding.Base64),
          mode === "large"
            ? Buffer.alloc(CommandCaptureLimit.Bytes, 255)
            : Buffer.from([0, 255, 195, 40]),
        );
        assert.deepEqual(
          Buffer.from(retained.stderr_base64, FileEncoding.Base64),
          mode === "large" ? Buffer.alloc(CommandCaptureLimit.Bytes, 128) : Buffer.from([128, 254]),
        );
      }
      assert(Buffer.byteLength(JSON.stringify(finished)) < CommandCaptureLimit.Bytes);
      assert.equal((await inspectArtifacts(finished)).proofs, path);
      return true;
    }
    if (mode.startsWith("capture-")) {
      const output = JSON.parse(
        await readFile(resolve(run.root, capture.output), FileEncoding.Utf8),
      );
      const retained = resolve(run.root, output.captures[0].capture.path);
      if (mode === "capture-changed") await writeFile(retained, "changed retained capture");
      if (mode === "capture-missing") await rm(retained);
      if (mode === "capture-linked") {
        await rename(retained, `${retained}.original`);
        await symlink(`${retained}.original`, retained);
      }
      await assert.rejects(inspectArtifacts(finished));
      return true;
    }
    if (mode.startsWith("output-")) {
      const output = resolve(run.root, capture.output);
      if (mode === "output-changed") await writeFile(output, "changed capture");
      if (mode === "output-missing") await rm(output);
      if (mode === "output-linked") {
        const parent = dirname(output);
        await rename(parent, `${parent}.retained`);
        await symlink(`${parent}.retained`, parent);
      }
      await assert.rejects(inspectArtifacts(finished));
      return true;
    }
    if (mode === "kept") {
      const inspected = await inspectArtifacts(finished);
      assert.equal(inspected.proofs, path);
      assert.equal(report.summary.proven, 1);
      assert.equal(report.discarded_attempts.total, 0);
      return true;
    }
    if (mode === "changed" || mode === "missing") {
      if (mode === "changed") await writeFile(path, JSON.stringify({ ...report, checks: [] }));
      else await rm(path);
      await assert.rejects(inspectArtifacts(finished));
      return true;
    }
    const event = await Array.fromAsync(new RunStore(run.root).events()).then((events) =>
      events.find((entry) => entry.type === RunEventKind.CheckAnswered),
    );
    assert(event);
    const record = report.checks[0];
    assert(record);
    const modified = {
      ...event,
      data:
        mode === "legacy"
          ? { answer: ProofAnswer.Proven }
          : {
              report: { ...record, answer: ProofAnswer.Refuted },
            },
    };
    if (mode !== "legacy") {
      const node = run.nodes.deliver;
      assert(node);
      node.state = StepStatus.Failed;
    }
    async function* events() {
      yield modified;
      if (mode === "budget") yield modified;
    }
    if (mode === "budget") {
      await assert.rejects(
        collectProofReport(
          run,
          events(),
          Buffer.byteLength(JSON.stringify(modified.data.report)) + 1,
        ),
      );
      return true;
    }
    const collected = await collectProofReport(run, events());
    if (mode === "legacy") {
      assert.equal(collected.history_complete, false);
      assert.equal(collected.checks.length, 0);
    } else {
      assert.equal(collected.summary.total, 0);
      assert.equal(collected.discarded_attempts.refuted, 1);
    }
    return true;
  });
}
