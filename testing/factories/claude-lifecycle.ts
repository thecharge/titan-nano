import { strict as assert } from "node:assert";
import { ClaudeBackend } from "@titan/backend-claude";
import { NativeStreamOutcome } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { agentSpec } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";

function usage(mode: NativeStreamOutcome) {
  return {
    test: {
      inputTokens: mode === NativeStreamOutcome.Malformed ? "invalid" : 5,
      outputTokens: 3,
    },
  };
}

function result(mode: NativeStreamOutcome) {
  return {
    type: "result",
    subtype: "success",
    session_id: "native-session",
    is_error: mode === NativeStreamOutcome.Failure,
    result: "done",
    structured_output: { ok: true, marker: "delivered", turn: 1 },
    modelUsage: usage(mode),
    total_cost_usd: 0.01,
    permission_denials: [],
  };
}

export async function claudeStreamLifecycle(mode: NativeStreamOutcome, resume: boolean, turns = 1) {
  let queries = 0;
  let closes = 0;
  let finalized = 0;
  let observed = 0;
  const backend = new ClaudeBackend(({ options }) => {
    assert.equal(options?.resume, resume || queries > 0 ? "native-session" : undefined);
    queries++;
    let closed = false;
    let attempts = 0;
    return Object.assign(
      (async function* () {
        try {
          yield result(mode);
        } finally {
          finalized++;
        }
      })(),
      {
        close() {
          assert.equal(closed, false, "A finished query must not be closed again");
          attempts++;
          if (mode === NativeStreamOutcome.CloseFailure && attempts === 1)
            throw new Error("Close refused");
          closed = true;
          closes++;
        },
      },
    ) as ReturnType<NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>>;
  });
  const spec = agentSpec("/tmp");
  const session = resume ? await backend.resume("native-session", spec) : await backend.start(spec);
  let failure: unknown;
  async function sendTurns() {
    for (let turn = 0; turn < turns; turn++) {
      const controller = new AbortController();
      const send = () =>
        session.send(
          "task",
          async (event) => {
            assert.deepEqual(event.data, result(mode));
            observed++;
            if (mode === NativeStreamOutcome.Cancel) await session.cancel("Stopped session");
            if (mode === NativeStreamOutcome.Close) await session.close();
            if (mode === NativeStreamOutcome.Abort) controller.abort(new Error("Stopped caller"));
            if (mode === NativeStreamOutcome.Cancel || mode === NativeStreamOutcome.Close)
              assert.equal(closes, queries);
          },
          controller.signal,
        );
      if (mode === NativeStreamOutcome.Complete) assert.equal((await send()).text, "done");
      else failure = await thrownBy(send);
      assert.equal(closes, mode === NativeStreamOutcome.CloseFailure ? 0 : queries);
      assert.equal(finalized, queries);
    }
  }
  try {
    await sendTurns();
  } finally {
    await session.close();
    assert.equal(closes, queries);
    await session.close();
    await session.cancel("Repeated cleanup");
  }
  assert.equal(closes, queries);
  assert.equal(finalized, queries);
  assert.equal(observed, queries);
  if (failure !== undefined) assert.ok(failure instanceof Error);
  if (mode === NativeStreamOutcome.CloseFailure)
    assert.equal(failure instanceof Error && failure.message, "Close refused");
  return {
    queries,
    closes,
    finalized,
    error: failure instanceof Error ? failure.name : null,
    code: failure instanceof OperationalError ? failure.code : null,
  };
}
