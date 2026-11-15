import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  Backend,
  ErrorCode,
  FileEncoding,
  IoLimit,
  SnapshotMutation,
  TextSymbol,
  VendorFixture,
  VendorStubMode,
} from "@titan/constants";
import { all } from "@titan/core";
import { readFileBytes } from "@titan/streams";
import { processExited, thrownBy, waitUntil } from "@titan/test-framework";
import {
  AgentAnswerSchema,
  type AgentBackend,
  type AgentSession,
  AgentSpecSchema,
  type TestAction,
  VendorNativeStateSchema,
  VendorStubCallSchema,
} from "@titan/types";

export function agentSpec(cwd: string) {
  const properties = {
    ok: { type: "boolean" },
    marker: { type: "string" },
    turn: { type: "integer" },
  };
  return AgentSpecSchema.parse({
    run_id: basename(cwd),
    invocation_id: "worker",
    execution_id: basename(cwd),
    cwd,
    role: "Transport contract role",
    model: "stub-model",
    tools: [],
    output_schema: {
      type: "object",
      properties,
      required: ["ok", "marker", "turn"],
    },
    writable: false,
    max_turns: 3,
  });
}

export async function observeVendorSession(
  backend: AgentBackend,
  cwd: string,
  resume: boolean,
  mode: VendorStubMode,
  beforeEvent: TestAction = async () => {},
  afterCancellation: TestAction = async () => {},
  role: string = "Transport contract role",
) {
  if (resume) {
    await mkdir(join(cwd, VendorFixture.StateDirectory), { recursive: true });
    await writeFile(
      join(
        cwd,
        VendorFixture.StateDirectory,
        `native-session-${Buffer.from("stub-native").toString("base64url")}.json`,
      ),
      Buffer.from(JSON.stringify({ session_id: "stub-native", turn: 0 })),
    );
  }
  const spec = { ...agentSpec(cwd), role };
  const session = resume ? await backend.resume("stub-native", spec) : await backend.start(spec);
  let observed: unknown;
  const deadline = AbortSignal.timeout(VendorFixture.TransportTimeoutMilliseconds);
  const handleEvent = async () => {
    await beforeEvent();
    if (mode === VendorStubMode.Cancel) {
      await session.cancel("Stop owned transport");
      await afterCancellation();
    }
  };
  const error = await thrownBy(async () => {
    observed = await session.send(mode, handleEvent, deadline);
  });
  await session.close();
  const calls = (
    await readFileBytes(join(cwd, VendorFixture.StateDirectory, "calls.jsonl"), IoLimit.DataBytes)
  )
    .toString(FileEncoding.Utf8)
    .trim()
    .split("\n");
  const call = VendorStubCallSchema.parse(JSON.parse(calls[0] ?? "null"));
  const answer = AgentAnswerSchema.safeParse(observed);
  const stopped = await waitUntil(async () => processExited(call.pid));
  return {
    stopped,
    timedOut: deadline.aborted,
    failed: error instanceof Error,
    completed: answer.success,
    correctAnswer:
      answer.success &&
      JSON.stringify(answer.data.json) === JSON.stringify({ ok: true, marker: cwd, turn: 1 }) &&
      answer.data.session_id === (resume ? "stub-native" : `stub-${call.pid}`) &&
      answer.data.usage.input_tokens === 4 &&
      answer.data.usage.output_tokens === 2,
    requestMatched: call.resume === resume,
    identityMatched:
      mode !== VendorStubMode.Unexpected ||
      (error instanceof Error && error.message.includes(`request: ${mode}`)),
    calls: calls.length,
  };
}

export async function observeVendorIsolation(
  backend: AgentBackend,
  root: string,
  cancel: boolean,
  reverse: boolean,
) {
  const first = join(root, reverse ? "b" : "a");
  const second = join(root, reverse ? "a" : "b");
  await all([() => mkdir(first), () => mkdir(second)]);
  let survivorSeen = false;
  let cancellationSeen = !cancel;
  let synchronized = true;
  let survivorLive = true;
  const [interrupted, survivor] = await all([
    () =>
      observeVendorSession(
        backend,
        first,
        false,
        cancel ? VendorStubMode.Cancel : VendorStubMode.Complete,
        async () => {
          synchronized &&= await waitUntil(async () => survivorSeen);
        },
        async () => {
          const call = VendorStubCallSchema.parse(
            JSON.parse(
              (
                await readFileBytes(
                  join(second, VendorFixture.StateDirectory, "calls.jsonl"),
                  IoLimit.DataBytes,
                )
              )
                .toString(FileEncoding.Utf8)
                .trim(),
            ),
          );
          survivorLive = !(await processExited(call.pid));
          cancellationSeen = true;
          await writeFile(
            join(second, VendorFixture.StateDirectory, "peer-cancelled"),
            Buffer.from("continue"),
          );
        },
      ),
    () =>
      observeVendorSession(
        backend,
        second,
        true,
        cancel ? VendorStubMode.AwaitPeer : VendorStubMode.Complete,
        async () => {
          survivorSeen = true;
          synchronized &&= await waitUntil(async () => cancellationSeen);
        },
      ),
  ]);
  return {
    firstFailed: interrupted.failed,
    secondFailed: survivor.failed,
    isolated:
      survivor.correctAnswer &&
      survivor.requestMatched &&
      interrupted.requestMatched &&
      survivor.calls === 1 &&
      interrupted.calls === 1 &&
      (cancel || interrupted.correctAnswer),
    stopped: interrupted.stopped && survivor.stopped,
    timedOut: interrupted.timedOut || survivor.timedOut,
    synchronized,
    survivorLive,
  };
}

export async function observeVendorContinuation(
  backend: AgentBackend,
  cwd: string,
  separate: boolean,
  mutation: SnapshotMutation,
) {
  const spec = agentSpec(cwd);
  const session = await backend.start(spec);
  let restored: AgentSession | undefined;
  const deadline = AbortSignal.timeout(VendorFixture.TransportTimeoutMilliseconds);
  let observed: unknown;
  try {
    const first = await session.send(VendorStubMode.Complete, async () => {}, deadline);
    if (separate) {
      await session.close();
      restored = await backend.resume(first.session_id, spec);
    }
    const nativeFile = join(
      cwd,
      VendorFixture.StateDirectory,
      `native-session-${Buffer.from(first.session_id).toString("base64url")}.json`,
    );
    if (mutation === SnapshotMutation.Deleted) await rm(nativeFile);
    if (mutation === SnapshotMutation.Changed) {
      const state = VendorNativeStateSchema.parse(
        JSON.parse(
          (await readFileBytes(nativeFile, IoLimit.DataBytes)).toString(FileEncoding.Utf8),
        ),
      );
      await writeFile(
        nativeFile,
        Buffer.from(JSON.stringify({ ...state, session_id: "unavailable" })),
      );
    }
    const error = await thrownBy(async () => {
      observed = await (restored ?? session).send(
        VendorStubMode.Complete,
        async () => {},
        deadline,
      );
    });
    await (restored ?? session).close();
    const calls = (
      await readFileBytes(join(cwd, VendorFixture.StateDirectory, "calls.jsonl"), IoLimit.DataBytes)
    )
      .toString(FileEncoding.Utf8)
      .trim()
      .split("\n")
      .map((line) => VendorStubCallSchema.parse(JSON.parse(line)));
    const answer = AgentAnswerSchema.safeParse(observed);
    const stopped = await all(
      calls.map((call) => async () => waitUntil(async () => processExited(call.pid))),
    );
    return {
      failed: error instanceof Error,
      continued:
        answer.success &&
        answer.data.session_id === first.session_id &&
        JSON.stringify(answer.data.json) === JSON.stringify({ ok: true, marker: cwd, turn: 2 }) &&
        answer.data.usage.input_tokens === (backend.id === Backend.Claude ? 8 : 4),
      starts: calls.filter((call) => !call.resume).length,
      resumes: calls.filter((call) => call.resume).length,
      stopped: stopped.every(Boolean),
      timedOut: deadline.aborted,
    };
  } finally {
    await session.close();
    await restored?.close();
  }
}

export async function observeVendorIdentity(
  backend: AgentBackend,
  cwd: string,
  separate: boolean,
  mode: VendorStubMode,
) {
  const spec = agentSpec(cwd);
  const original = await backend.start(spec);
  let restored: AgentSession | undefined;
  const deadline = AbortSignal.timeout(VendorFixture.TransportTimeoutMilliseconds);
  try {
    const first = await original.send(VendorStubMode.Complete, async () => {}, deadline);
    if (separate) {
      await original.close();
      restored = await backend.resume(first.session_id, spec);
    }
    const session = restored ?? original;
    let originalOnly = true;
    let completed = false;
    const error = await thrownBy(async () => {
      const answer = await session.send(
        mode,
        async (event) => {
          originalOnly &&= event.session_id === first.session_id;
        },
        deadline,
      );
      completed = answer.session_id === first.session_id;
    });
    const retry = await session.send(VendorStubMode.Complete, async () => {}, deadline);
    await session.close();
    const calls = (
      await readFileBytes(join(cwd, VendorFixture.StateDirectory, "calls.jsonl"), IoLimit.DataBytes)
    )
      .toString(FileEncoding.Utf8)
      .trim()
      .split("\n")
      .map((line) => VendorStubCallSchema.parse(JSON.parse(line)));
    const stopped = await all(
      calls.map((call) => async () => waitUntil(async () => processExited(call.pid))),
    );
    return {
      completed,
      unavailable:
        error instanceof Error && "code" in error && error.code === ErrorCode.SessionUnavailable,
      originalOnly,
      retryPreserved:
        retry.session_id === first.session_id &&
        JSON.stringify(retry.json) === JSON.stringify({ ok: true, marker: cwd, turn: 3 }) &&
        retry.usage.input_tokens === (backend.id === Backend.Claude ? 12 : 4) &&
        retry.usage.output_tokens === (backend.id === Backend.Claude ? 6 : 2),
      starts: calls.filter((call) => !call.resume).length,
      resumes: calls.filter((call) => call.resume).length,
      stopped: stopped.every(Boolean),
      timedOut: deadline.aborted,
    };
  } finally {
    await original.close();
    await restored?.close();
  }
}

export async function observeVendorSessionBytes(
  backend: AgentBackend,
  cwd: string,
  oversized: boolean,
  resume: boolean,
) {
  let padded = false;
  const padCall = async () => {
    if (padded) return;
    padded = true;
    const path = join(cwd, VendorFixture.StateDirectory, "calls.jsonl");
    const record = await readFileBytes(path, IoLimit.DataBytes);
    const content = Buffer.alloc(IoLimit.DataBytes + Number(oversized), TextSymbol.Space);
    record.copy(content);
    await writeFile(path, content);
  };
  return observeVendorSession(backend, cwd, resume, VendorStubMode.Complete, padCall);
}
