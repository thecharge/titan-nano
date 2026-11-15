import { expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ClaudeBackend } from "@titan/backend-claude";
import { CodexBackend } from "@titan/backend-codex";
import type { SdkArgumentField } from "@titan/constants";
import type { AgentEvent, AgentSpec } from "@titan/types";

async function discardEvent(): Promise<void> {}

const spec: AgentSpec = {
  run_id: "run",
  invocation_id: "step/1/worker",
  execution_id: "execution",
  cwd: "/tmp",
  role: "Test role",
  model: null,
  tools: [],
  output_schema: { type: "object" },
  writable: false,
  max_turns: 3,
};
export function codex(
  events: unknown[],
  capture: Record<string, unknown>,
): NonNullable<ConstructorParameters<typeof CodexBackend>[0]> {
  return {
    startThread(options: unknown) {
      capture.options = options;
      return {
        async runStreamed(prompt: unknown, turn: unknown) {
          capture.prompt = prompt;
          capture.turn = turn;
          return {
            events: (async function* () {
              yield* events;
            })(),
          };
        },
      };
    },
    resumeThread(id: string, options: unknown) {
      capture.resume = id;
      return {
        async runStreamed(prompt: unknown, turn: unknown) {
          capture.prompt = prompt;
          capture.turn = turn;
          capture.options = options;
          return {
            events: (async function* () {
              yield* events;
            })(),
          };
        },
      };
    },
  } as unknown as NonNullable<ConstructorParameters<typeof CodexBackend>[0]>;
}
export function claude(
  events: unknown[],
  inspect: (
    options: NonNullable<
      Parameters<
        NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>
      >[0][SdkArgumentField.Options]
    >,
  ) => void,
): NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]> {
  return ({ options }) => {
    if (!options) throw new Error("Adapter fixture requires explicit SDK options");
    inspect(options);
    const stream = (async function* () {
      yield* events;
    })();
    return Object.assign(stream, { close() {} }) as ReturnType<
      NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>
    >;
  };
}
export const result = {
  type: "result",
  subtype: "success",
  session_id: "claude-session",
  is_error: false,
  result: "done",
  structured_output: { ok: true },
  modelUsage: { test: { inputTokens: 5, outputTokens: 3 } },
  total_cost_usd: 0.01,
  permission_denials: [],
};
export const codexStreamedAnswer = async () => {
  const capture: Record<string, unknown> = {};
  const received: AgentEvent[] = [];
  const backend = new CodexBackend(
    codex(
      [
        { type: "thread.started", thread_id: "native-1" },
        { type: "item.completed", item: { type: "agent_message", text: '{"ok":true}' } },
        { type: "turn.completed", usage: { input_tokens: 10, output_tokens: 2 } },
      ],
      capture,
    ),
  );
  const session = await backend.resume("native-1", spec);
  const answer = await session.send(
    "task",
    async (event) => {
      received.push(event);
    },
    new AbortController().signal,
  );
  expect(capture.resume).toBe("native-1");
  expect(capture.prompt).toContain("Test role");
  expect(capture.options).toMatchObject({
    sandboxMode: "read-only",
    networkAccessEnabled: false,
    approvalPolicy: "never",
  });
  expect(answer.json).toEqual({ ok: true });
  expect(answer.usage.cost_usd).toBeNull();
  expect(received[0]?.session_id).toBe("native-1");
  await session.close();
};
export const codexIncompleteStreams = async () => {
  for (const events of [[{ type: "error", message: "Stub unavailable" }], []]) {
    const session = await new CodexBackend(codex(events, {})).start(spec);
    await expect(
      session.send("task", discardEvent, new AbortController().signal),
    ).rejects.toMatchObject({ exitCode: 3 });
    await session.cancel("done");
    await session.close();
  }
};
export const claudeExactResume = async () => {
  const backend = new ClaudeBackend(
    claude([result], (options) => {
      expect(options.resume).toBe("claude-session");
      expect(options.tools).toEqual([]);
      expect(options.settingSources).toEqual([]);
      expect(options.permissionMode).toBe("default");
      expect(options.hooks?.PreToolUse?.[0]?.onFailure).toBe("block");
    }),
  );
  const session = await backend.resume("claude-session", spec);
  const answer = await session.send("task", discardEvent, new AbortController().signal);
  expect(answer.json).toEqual({ ok: true });
  expect(answer.usage.input_tokens).toBe(5);
  await session.close();
};
export const claudeMandatoryPaths = async () => {
  const cwd = await mkdtemp(resolve(tmpdir(), "titan-permission-"));
  let options:
    | Parameters<
        NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>
      >[0][SdkArgumentField.Options]
    | undefined;
  try {
    const session = await new ClaudeBackend(
      claude([result], (value) => {
        options = value;
      }),
    ).start({ ...spec, cwd, tools: ["Read"] });
    await session.send("task", discardEvent, new AbortController().signal);
    const callback = options?.hooks?.PreToolUse?.[0]?.hooks[0];
    if (!callback) throw new Error("Missing required hook");
    const input = {
      session_id: "test",
      transcript_path: "unused",
      cwd,
      hook_event_name: "PreToolUse" as const,
      tool_name: "Read",
      tool_input: { file_path: "../person-token" },
      tool_use_id: "call",
    };
    expect(await callback(input, "call", { signal: new AbortController().signal })).toMatchObject({
      hookSpecificOutput: { permissionDecision: "deny" },
    });
    expect(
      await callback({ ...input, tool_input: { file_path: "inside.txt" } }, "call", {
        signal: new AbortController().signal,
      }),
    ).toMatchObject({ hookSpecificOutput: { permissionDecision: "allow" } });
    expect(
      await callback(
        { ...input, tool_name: "Bash", tool_input: { command: "echo hello" } },
        "call",
        { signal: new AbortController().signal },
      ),
    ).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny" } });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
};
export const claudeErrorResult = async () => {
  const session = await new ClaudeBackend(claude([{ ...result, is_error: true }], () => {})).start(
    spec,
  );
  await expect(
    session.send("task", discardEvent, new AbortController().signal),
  ).rejects.toMatchObject({ code: "claude_execution" });
};
export const claudePermissionCancellation = async () => {
  let captured:
    | Parameters<
        NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>
      >[0][SdkArgumentField.Options]
    | undefined;
  const session = await new ClaudeBackend(
    claude([result], (options) => {
      captured = options;
    }),
  ).start({ ...spec, tools: ["Read"] });
  const signal = new AbortController();
  await session.send("task", discardEvent, signal.signal);
  if (!captured?.canUseTool) throw new Error("Missing permission callback");
  const context = { signal: signal.signal, toolUseID: "stub", requestId: "stub-request" };
  expect(
    await captured.canUseTool("Read", { file_path: "/tmp/inside.txt" }, context),
  ).toMatchObject({ behavior: "allow" });
  expect(await captured.canUseTool("Read", { file_path: "/etc/passwd" }, context)).toMatchObject({
    behavior: "deny",
  });
  expect(await captured.canUseTool("Bash", {}, context)).toMatchObject({ behavior: "deny" });
  expect(await captured.canUseTool("StructuredOutput", { summary: "done" }, context)).toMatchObject(
    {
      behavior: "allow",
    },
  );
  signal.abort(new Error("stop"));
  await session.cancel("stop");
  expect(captured.abortController?.signal.aborted).toBe(true);
  await session.close();
};
export const codexMalformedUsage = async () => {
  const session = await new CodexBackend(
    codex(
      [
        { type: "thread.started", thread_id: "native" },
        { type: "turn.completed", usage: { input_tokens: "wrong", output_tokens: 1 } },
      ],
      {},
    ),
  ).start(spec);
  await expect(
    session.send("task", discardEvent, new AbortController().signal),
  ).rejects.toMatchObject({ code: "codex_protocol", exitCode: 3 });
};
export const claudeMalformedUsage = async () => {
  const session = await new ClaudeBackend(
    claude(
      [{ ...result, modelUsage: { test: { inputTokens: "wrong", outputTokens: 1 } } }],
      () => {},
    ),
  ).start(spec);
  await expect(
    session.send("task", discardEvent, new AbortController().signal),
  ).rejects.toMatchObject({ code: "claude_protocol", exitCode: 3 });
};
export const claudeCompletedTransport = async (event: typeof result) => {
  const session = await new ClaudeBackend(claude([event], () => {})).start(spec);
  expect((await session.send("task", discardEvent, new AbortController().signal)).json).toEqual(
    event.structured_output,
  );
  await session.close();
};
export const claudeOperationalResult = async (subtype: string) => {
  const session = await new ClaudeBackend(
    claude([{ ...result, subtype, errors: ["first error", "second error"] }], () => {}),
  ).start(spec);
  await expect(
    session.send("task", discardEvent, new AbortController().signal),
  ).rejects.toMatchObject({ code: "claude_execution", message: "first error; second error" });
  await session.close();
};
export const claudeLateResult = async (reason: string) => {
  const controller = new AbortController();
  const session = await new ClaudeBackend(
    claude([result], () => {
      controller.abort(new Error(reason));
    }),
  ).start(spec);
  await expect(session.send("task", discardEvent, controller.signal)).rejects.toThrow(reason);
  await session.close();
};
export const claudeResultCancellation = async (internal: boolean) => {
  const controller = new AbortController();
  const session = await new ClaudeBackend(claude([result], () => {})).start(spec);
  await expect(
    session.send(
      "task",
      async () => {
        if (internal) await session.cancel("Stopped session");
        else controller.abort(new Error("Stopped caller"));
      },
      controller.signal,
    ),
  ).rejects.toThrow(internal ? "Stopped session" : "Stopped caller");
  await session.close();
};
