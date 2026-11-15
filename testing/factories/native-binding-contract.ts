import { strict as assert } from "node:assert";
import { Codex } from "@openai/codex-sdk";
import { ClaudeBackend } from "@titan/backend-claude";
import { CodexBackend } from "@titan/backend-codex";
import { nativeAgentEnvironment } from "@titan/config";
import {
  Backend,
  ErrorCode,
  NativeBindingFixture,
  NativeToolEnvironment,
  NativeToolRole,
} from "@titan/constants";
import { nativeBinding, newId } from "@titan/core";
import { NativeToolBridgeMessage } from "@titan/messages";
import { agentSpec } from "@titan/test-factories";
import type { NativeBackendId, NativeToolBinding } from "@titan/types";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";

function binding() {
  const connection = nativeBridgeConnection(NativeToolRole.Worker, "/tmp");
  const value: NativeToolBinding = { connection, launch: { command: process.execPath, args: [] } };
  const spec = {
    ...agentSpec("/tmp"),
    run_id: connection.scope.run_id,
    execution_id: connection.scope.execution_id,
  };
  return { value, spec };
}

export function nativeBindingContract(mode: NativeBindingFixture) {
  const { value, spec } = binding();
  if (mode === NativeBindingFixture.Run) spec.run_id = newId();
  if (mode === NativeBindingFixture.Execution) spec.execution_id = newId();
  if (mode === NativeBindingFixture.Launch) value.launch.command = "relative";
  if (mode === NativeBindingFixture.Credential) value.launch.args.push(value.connection.token);
  const input = mode === NativeBindingFixture.Omitted ? undefined : value;
  return nativeBinding(spec, input) === undefined ? null : true;
}

export function nativeEnvironmentBudget(markers: number, workers: number, accepted: boolean) {
  const { value } = binding();
  const environment = {
    [NativeToolEnvironment.GcMarkers]: String(markers),
    [NativeToolEnvironment.WorkerThreads]: String(workers),
  };
  const assemble = () => nativeAgentEnvironment(value.connection, environment);
  if (accepted) {
    const configured = assemble();
    assert.equal(configured[NativeToolEnvironment.GcMarkers], String(markers));
    assert.equal(configured[NativeToolEnvironment.WorkerThreads], String(workers));
  } else assert.throws(assemble);
  return true;
}

export async function nativeBindingEnvironment(
  backend: NativeBackendId,
  configured: boolean,
  injected = false,
) {
  const { value, spec } = binding();
  const environment = configured ? nativeAgentEnvironment : undefined;
  const client = injected ? new Codex() : undefined;
  const adapter =
    backend === Backend.Codex
      ? new CodexBackend(client, {}, environment)
      : new ClaudeBackend(undefined, {}, environment);
  if (configured && !injected) {
    const session = await adapter.start(spec, value);
    await session.close();
  } else {
    await assert.rejects(adapter.start(spec, value), {
      code: backend === Backend.Codex ? ErrorCode.PermissionDenied : ErrorCode.ServerUnavailable,
      message: NativeToolBridgeMessage.Startup,
    });
    await assert.rejects(adapter.resume("native-session", spec, value), {
      message: NativeToolBridgeMessage.Startup,
    });
  }
  const inherited = nativeAgentEnvironment(value.connection, {
    PRESENT: "retained",
    ABSENT: undefined,
  });
  assert.equal(inherited.PRESENT, "retained");
  assert.equal("ABSENT" in inherited, false);
  return true;
}
