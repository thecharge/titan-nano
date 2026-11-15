import { strict as assert } from "node:assert";
import type { Options, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeBackend } from "@titan/backend-claude";
import { nativeAgentEnvironment } from "@titan/config";
import {
  ClaudeEventKind,
  ClaudeNativeTool,
  ClaudePermission,
  ErrorCode,
  KnowledgeTool,
  NativeRuntimeFixture,
  NativeTool,
  NativeToolPolicy,
  type NativeToolRole,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { NativeToolBridgeMessage } from "@titan/messages";
import { agentSpec } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import type { NativeToolBinding } from "@titan/types";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";

async function nativePermissions(options: Options | undefined, binding: NativeToolBinding) {
  const hook = options?.hooks?.PreToolUse?.[0]?.hooks[0];
  assert.ok(hook && options?.canUseTool);
  const allowed = NativeToolPolicy[binding.connection.scope.role].map(
    (tool) => ClaudeNativeTool.Prefix + tool,
  );
  for (const name of [
    ...allowed,
    "mcp__other__titan_kb_get",
    ClaudeNativeTool.Prefix + KnowledgeTool.Reindex,
    ClaudeNativeTool.Prefix + KnowledgeTool.Add,
  ]) {
    const signal = new AbortController().signal;
    const expected = allowed.includes(name) ? ClaudePermission.Allow : ClaudePermission.Deny;
    const observed = await hook(
      {
        session_id: "native-session",
        transcript_path: "unused",
        cwd: binding.connection.run_directory,
        hook_event_name: ClaudeEventKind.PreToolUse,
        tool_name: name,
        tool_input: {},
        tool_use_id: "native-call",
      },
      "native-call",
      { signal },
    );
    assert.ok("hookSpecificOutput" in observed);
    assert.ok(observed.hookSpecificOutput?.hookEventName === ClaudeEventKind.PreToolUse);
    assert.equal(observed.hookSpecificOutput.permissionDecision, expected);
    const permission: PermissionResult | null = await options.canUseTool(
      name,
      {},
      { signal, toolUseID: "native-call", requestId: "native-request" },
    );
    assert.ok(permission);
    assert.equal(permission.behavior, expected);
  }
}

export async function nativeRuntimeReadiness(role: NativeToolRole, mode: NativeRuntimeFixture) {
  const connection = nativeBridgeConnection(role, "/tmp");
  connection.timeout_ms = mode === NativeRuntimeFixture.Deadline ? 40 : 1000;
  const binding: NativeToolBinding = {
    connection,
    launch: { command: process.execPath, args: [] },
  };
  const controller = new AbortController();
  let delivered = false;
  let closed = 0;
  let statuses = 0;
  let task: Promise<IteratorResult<unknown>> | undefined;
  const backend = new ClaudeBackend(
    ({ prompt, options }) => {
      assert.notEqual(typeof prompt, "string");
      if (typeof prompt === "string") throw new Error("Native task was not gated");
      task = prompt[Symbol.asyncIterator]()
        .next()
        .then((result) => {
          delivered = !result.done;
          return result;
        });
      void task.catch(() => {});
      return Object.assign(
        (async function* () {
          await task;
          await nativePermissions(options, binding);
          yield {
            type: "result",
            subtype: "success",
            session_id: "native-session",
            is_error: false,
            result: "done",
            structured_output: { ok: true },
            modelUsage: {},
            total_cost_usd: 0,
            permission_denials: [],
          };
        })(),
        {
          close() {
            closed++;
          },
          async initializationResult() {
            assert.equal(delivered, false);
            if (mode === NativeRuntimeFixture.Initialize)
              throw new Error("Private initialization failure");
            if (mode === NativeRuntimeFixture.Cancelled) controller.abort();
            return {};
          },
          async mcpServerStatus() {
            statuses++;
            assert.equal(delivered, false);
            if (mode === NativeRuntimeFixture.Status) throw new Error("Private status failure");
            if (mode === NativeRuntimeFixture.Missing) return [];
            const names: string[] = [...NativeToolPolicy[role]];
            if (mode === NativeRuntimeFixture.Inventory) names.pop();
            if (mode === NativeRuntimeFixture.Duplicate) names[0] = names[1] ?? NativeTool.Ready;
            const tools = names.map((name) => ({
              name: mode === NativeRuntimeFixture.Prefixed ? ClaudeNativeTool.Prefix + name : name,
            }));
            const status =
              mode === NativeRuntimeFixture.Failed
                ? "failed"
                : mode === NativeRuntimeFixture.Deadline ||
                    (mode === NativeRuntimeFixture.Pending && statuses === 1)
                  ? "pending"
                  : "connected";
            return [{ name: NativeTool.Name, status, tools }];
          },
        },
      ) as ReturnType<NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>>;
    },
    {},
    nativeAgentEnvironment,
  );
  const spec = {
    ...agentSpec("/tmp"),
    run_id: connection.scope.run_id,
    execution_id: connection.scope.execution_id,
  };
  const session = await backend.start(spec, binding);
  const error = await thrownBy(() => session.send("task", async () => {}, controller.signal));
  await task?.catch(() => {});
  const accepted = [
    NativeRuntimeFixture.Ready,
    NativeRuntimeFixture.Prefixed,
    NativeRuntimeFixture.Pending,
  ].includes(mode);
  assert.equal(delivered, accepted);
  assert.equal(closed, 1);
  await session.close();
  assert.equal(closed, 1);
  if (accepted) assert.equal(error, undefined);
  else {
    assert.ok(error instanceof OperationalError);
    assert.equal(error.code, ErrorCode.ServerUnavailable);
    assert.equal(error.message, NativeToolBridgeMessage.Startup);
  }
  if (mode === NativeRuntimeFixture.Pending) assert.equal(statuses, 2);
  return true;
}
