import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveConfig } from "@titan/config";
import { Backend, ConfigFile, ErrorCode, LogEvent, LogLevel, RunStatus } from "@titan/constants";
import { all } from "@titan/core";
import { TitanError } from "@titan/errors";
import { createLogger } from "@titan/logger";
import { call, startServer } from "@titan/server";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type LogRecord,
  LogRecordSchema,
  RunSnapshotSchema,
  type ServerHealth,
  ServerHealthSchema,
} from "@titan/types";
import { observeRun } from "../../packages/server/src/background.ts";
import { createFakeBackend } from "../support/backend.ts";

function diagnosticOwner(level: LogLevel) {
  const logging = { level };
  return { server: { logging } };
}

function backgroundFailure(mode: string): Error | null {
  if (mode === "typed") return new TitanError(ErrorCode.Capacity, "private failure content");
  if (mode === "unlisted-code") return new TitanError("unlisted-code", "private failure content");
  if (mode === "unknown") return new Error("private failure content");
  return null;
}

export async function backgroundLog(mode: string) {
  const records: LogRecord[] = [];
  const logger = await createLogger({ level: LogLevel.Info }, async (bytes) => {
    assert.ok(!bytes.includes(Buffer.from("private failure content")));
    records.push(LogRecordSchema.parse(JSON.parse(bytes.toString())));
    return bytes.length;
  });
  const errors = mode === "parallel" ? [null, null] : [backgroundFailure(mode)];
  await all(
    errors.map(
      (error, index) => () =>
        observeRun(error ? Promise.reject(error) : Promise.resolve(), `run-${index}`, logger),
    ),
  );
  assert.deepEqual(
    records.map((record) => record.run_id),
    errors.map((_, index) => `run-${index}`),
  );
  return {
    events: records.map((record) => record.event),
    codes: records.map((record) => record.code ?? null),
  };
}

export async function serverDiagnostics(info: boolean, failSink = false) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await all([() => mkdir(home), () => mkdir(project)]);
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(JSON.stringify(diagnosticOwner(info ? LogLevel.Info : LogLevel.Warn))),
    );
    const records: LogRecord[] = [];
    const server = await startServer(home, createFakeBackend, {
      diagnosticSink: async (bytes) => {
        records.push(LogRecordSchema.parse(JSON.parse(bytes.toString())));
        return failSink ? 0 : bytes.length;
      },
    });
    let health: ServerHealth | undefined;
    try {
      const run = RunSnapshotSchema.parse(
        await call(home, "/runs", "POST", {
          project,
          workflow: vendorRecoveryWorkflow(),
          backend: Backend.Fake,
          client_id: "logger-owner",
          submission_id: "logger-run",
        }),
      );
      assert.ok(
        await waitUntil(async () => {
          const current = RunSnapshotSchema.parse(await call(home, `/runs/${run.run_id}`));
          const counters = ServerHealthSchema.parse(await call(home, "/health")).diagnostics;
          return (
            current.state === RunStatus.Passed &&
            counters.written + counters.filtered + counters.rejected + counters.failed === 2
          );
        }),
      );
      health = ServerHealthSchema.parse(await call(home, "/health"));
      for (const record of records.filter((record) => record.event === LogEvent.RunSettled))
        assert.equal(record.run_id, run.run_id);
    } finally {
      await server.stop();
    }
    const events = info ? [LogEvent.ServerReady] : [];
    if (info && !failSink) events.push(LogEvent.RunSettled, LogEvent.ServerStopped);
    assert.deepEqual(
      records.map((record) => record.event),
      events,
    );
    assert.ok(health);
    return { ready: health.ready, ...health.diagnostics };
  });
}

export async function loggerConfiguration(layer: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await all([() => mkdir(home), () => mkdir(project)]);
    const value = diagnosticOwner(LogLevel.Info);
    if (layer === "owner")
      await writeFile(resolve(home, ConfigFile.User), Buffer.from(JSON.stringify(value)));
    if (layer === "project") {
      const path = resolve(project, ConfigFile.Project);
      await mkdir(dirname(path));
      await writeFile(path, Buffer.from(JSON.stringify(value)));
    }
    const config = await resolveConfig({
      home,
      project,
      ...(layer === "workflow" ? { workflow: value } : {}),
      ...(layer === "cli" ? { overrides: value } : {}),
    });
    if (layer === "legacy") assert.equal(Object.hasOwn(config.value.server, "logging"), false);
    return config.value.server.logging?.level ?? null;
  });
}
