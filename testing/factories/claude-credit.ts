import { strict as assert } from "node:assert";
import { ClaudeBackend } from "@titan/backend-claude";
import { ClaudeEventKind } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { ClaudeMessage } from "@titan/messages";
import { agentSpec } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";

export async function claudeCredit(event: unknown) {
  const native = Object.assign(
    {
      type: ClaudeEventKind.Assistant,
      session_id: "native",
      parent_tool_use_id: null,
    },
    event,
  );
  const modelUsage = { stub: { inputTokens: 4, outputTokens: 2 } };
  const final = {
    type: ClaudeEventKind.Result,
    subtype: ClaudeEventKind.Success,
    session_id: "native",
    is_error: false,
    result: "done",
    structured_output: { ok: true },
    modelUsage,
    total_cost_usd: 0,
    permission_denials: [],
    num_turns: 1,
  };
  let closed = 0;
  let observed = 0;
  let completed = false;
  const backend = new ClaudeBackend(
    () =>
      Object.assign(
        (async function* () {
          yield native;
          yield final;
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
    const error = await thrownBy(async () => {
      const answer = await session.send(
        "credit contract",
        async () => {
          observed++;
        },
        new AbortController().signal,
      );
      assert.deepEqual(answer.json, final.structured_output);
      completed = true;
    });
    if (error) {
      assert.ok(error instanceof OperationalError);
      assert.equal(error.message, ClaudeMessage.QuotaExhausted);
    }
    return {
      completed,
      code: error instanceof OperationalError ? error.code : null,
      retryable: error instanceof OperationalError && error.retryable,
      delay: error instanceof OperationalError ? error.retryAfterMs : 0,
      observed,
      closed,
    };
  } finally {
    await session.close();
  }
}
