import { join } from "node:path";
import { CodexBackend } from "@titan/backend-codex";
import { Backend, type SnapshotMutation, type VendorStubMode } from "@titan/constants";
import {
  observeVendorContinuation,
  observeVendorIdentity,
  observeVendorIsolation,
  observeVendorRecovery,
  observeVendorSession,
  observeVendorSessionBytes,
} from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";

function backend() {
  const executable = join(import.meta.dir, "../fixtures/vendors/codex-0.171.0.mjs");
  return new CodexBackend(undefined, { executable });
}

export async function codexTransport(resume: boolean, mode: VendorStubMode) {
  return withTemporaryDirectory(async (cwd) => observeVendorSession(backend(), cwd, resume, mode));
}

export async function codexIsolation(cancel: boolean, reverse: boolean) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorIsolation(backend(), cwd, cancel, reverse),
  );
}

export async function codexContinuation(separate: boolean, mutation: SnapshotMutation) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorContinuation(backend(), cwd, separate, mutation),
  );
}

export async function codexRecovery(restart: boolean, allowance: number, task?: string) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorRecovery(() => backend(), Backend.Codex, cwd, restart, allowance, task),
  );
}

export async function codexIdentity(separate: boolean, mode: VendorStubMode) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorIdentity(backend(), cwd, separate, mode),
  );
}

export async function codexFixtureBytes(oversized: boolean, resume: boolean) {
  return withTemporaryDirectory(async (cwd) => {
    const result = await observeVendorSessionBytes(backend(), cwd, oversized, resume);
    return { completed: result.completed, calls: result.calls, stopped: result.stopped };
  });
}
