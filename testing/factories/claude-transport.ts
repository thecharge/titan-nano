import { strict as assert } from "node:assert";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeBackend } from "@titan/backend-claude";
import {
  Backend,
  ClaudeEventKind,
  type SnapshotMutation,
  type VendorStubMode,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import {
  agentSpec,
  observeVendorContinuation,
  observeVendorIdentity,
  observeVendorIsolation,
  observeVendorRecovery,
  observeVendorRetry,
  observeVendorSession,
  observeVendorSessionBytes,
} from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";

function backend(cwd: string) {
  const backend = new ClaudeBackend(({ prompt, options }) => {
    const env = { PATH: process.env.PATH, HOME: cwd, CLAUDE_CONFIG_DIR: cwd };
    return query({
      prompt,
      options: {
        ...options,
        pathToClaudeCodeExecutable: join(import.meta.dir, "../fixtures/vendors/claude-0.3.319.mjs"),
        executable: "bun",
        env,
      },
    });
  });
  return backend;
}

export async function claudeTransport(resume: boolean, mode: VendorStubMode) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorSession(backend(cwd), cwd, resume, mode),
  );
}

export async function claudeIsolation(cancel: boolean, reverse: boolean) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorIsolation(backend(cwd), cwd, cancel, reverse),
  );
}

export async function claudeContinuation(separate: boolean, mutation: SnapshotMutation) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorContinuation(backend(cwd), cwd, separate, mutation),
  );
}

export async function claudeRecovery(restart: boolean, allowance: number, task?: string) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorRecovery(() => backend(cwd), Backend.Claude, cwd, restart, allowance, task),
  );
}

export async function claudeIdentity(separate: boolean, mode: VendorStubMode) {
  return withTemporaryDirectory(async (cwd) =>
    observeVendorIdentity(backend(cwd), cwd, separate, mode),
  );
}

export async function claudeRetryRecovery(
  worker: boolean,
  task: VendorStubMode,
  allowance: number,
) {
  return withTemporaryDirectory(async (root) =>
    observeVendorRetry(() => backend(root), Backend.Claude, root, worker, task, allowance),
  );
}

export async function claudeRetryFields(event: unknown) {
  const native = Object.assign(
    { type: ClaudeEventKind.System, subtype: ClaudeEventKind.ApiRetry },
    event,
  );
  let closed = 0;
  let observed = 0;
  const backend = new ClaudeBackend(
    () =>
      Object.assign(
        (async function* () {
          yield native;
        })(),
        {
          close() {
            closed++;
          },
        },
      ) as ReturnType<NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>>,
  );
  const session = await backend.start(agentSpec(process.cwd()));
  try {
    const error = await thrownBy(() =>
      session.send(
        "retry",
        async (event) => {
          assert.deepEqual(event.data, native);
          observed++;
        },
        new AbortController().signal,
      ),
    );
    assert.ok(error instanceof OperationalError);
    assert.equal(closed, 1);
    assert.equal(observed, 1);
    return { code: error.code, retryable: error.retryable, delay: error.retryAfterMs };
  } finally {
    await session.close();
  }
}

export async function claudeFixtureBytes(oversized: boolean, resume: boolean) {
  return withTemporaryDirectory(async (cwd) => {
    const result = await observeVendorSessionBytes(backend(cwd), cwd, oversized, resume);
    return { completed: result.completed, calls: result.calls, stopped: result.stopped };
  });
}
