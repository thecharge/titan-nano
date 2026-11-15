import { strict as assert } from "node:assert";
import {
  AgentEventKind,
  ClaudeNativeTool,
  ErrorCode,
  KnowledgeTool,
  NativeCodexStatus,
  NativeEventActivity,
  NativeEventField,
  NativeEventFixture,
  NativeTool,
  NativeToolAudit,
  NativeVendorEvent,
  RuntimeLimit,
} from "@titan/constants";
import { NativeToolMessage } from "@titan/messages";
import { projectNativeEvent } from "@titan/runner";
import { NativeEventProjectionSchema } from "@titan/types";

function codexData(mode: NativeEventFixture, body: string) {
  const item = {
    id: mode === NativeEventFixture.MissingIdentity ? "" : "native-call",
    type: NativeVendorEvent.CodexTool,
    server: mode === NativeEventFixture.External ? "external" : NativeTool.Name,
    tool: mode === NativeEventFixture.UnknownTool ? body : KnowledgeTool.Get,
    status: mode === NativeEventFixture.UnsupportedStatus ? body : NativeCodexStatus.Completed,
    arguments: { query: body },
    result: { content: body },
    error: body,
  };
  const type =
    mode === NativeEventFixture.CodexStarted
      ? NativeVendorEvent.CodexStarted
      : mode === NativeEventFixture.CodexUpdated
        ? NativeVendorEvent.CodexUpdated
        : NativeVendorEvent.CodexCompleted;
  return { type, item };
}

export function nativeEventData(mode: NativeEventFixture, body: string): unknown {
  if (
    [
      NativeEventFixture.Codex,
      NativeEventFixture.CodexStarted,
      NativeEventFixture.CodexUpdated,
      NativeEventFixture.UnknownTool,
      NativeEventFixture.External,
      NativeEventFixture.MissingIdentity,
      NativeEventFixture.UnsupportedStatus,
    ].includes(mode)
  )
    return codexData(mode, body);
  if (mode === NativeEventFixture.Unmarked) return body;
  if (mode === NativeEventFixture.Ordinary) return { type: "ordinary", text: body };
  if (mode === NativeEventFixture.ClaudePartial)
    return { type: NativeVendorEvent.ClaudePartial, event: body };
  const use = [
    NativeEventFixture.ClaudeUse,
    NativeEventFixture.ClaudeExternal,
    NativeEventFixture.ClaudeText,
  ].includes(mode);
  const block = use
    ? {
        type: NativeVendorEvent.ClaudeUse,
        id: "native-call",
        name:
          mode === NativeEventFixture.ClaudeExternal
            ? KnowledgeTool.Get
            : ClaudeNativeTool.Prefix + KnowledgeTool.Get,
        input: body,
      }
    : {
        type: NativeVendorEvent.ClaudeResult,
        tool_use_id: mode === NativeEventFixture.ClaudeMissingIdentity ? "" : "native-call",
        content: body,
      };
  const text = { type: "text", text: body };
  const content =
    mode === NativeEventFixture.ClaudeStructured || mode === NativeEventFixture.ClaudeText
      ? body
      : [text, block];
  const message = {
    content:
      mode === NativeEventFixture.ExcessBlocks
        ? Array.from({ length: RuntimeLimit.PendingOperations + 1 }, () => block)
        : mode === NativeEventFixture.ClaudeBadBlock
          ? [null]
          : content,
  };
  return {
    type: use ? NativeVendorEvent.ClaudeAssistant : NativeVendorEvent.ClaudeUser,
    message,
    [NativeEventField.ToolResult]: body,
  };
}

export function nativeEventProjection(
  mode: NativeEventFixture,
  enabled: boolean,
  projects: boolean,
  refuses: boolean,
) {
  const body = "Private native entry and vendor exception";
  const event = {
    type: AgentEventKind.ToolResult,
    session_id: "native-session",
    data: nativeEventData(mode, body),
  };
  if (refuses) {
    assert.throws(() => projectNativeEvent(event, enabled), {
      code: ErrorCode.NativeToolProtocol,
      message: NativeToolMessage.Event,
    });
    return true;
  }
  const projected = projectNativeEvent(event, enabled);
  if (!projects) {
    assert.equal(projected, event);
    return true;
  }
  const metadata = NativeEventProjectionSchema.parse(projected.data);
  assert.equal(projected.session_id, event.session_id);
  assert.equal(projected.type, event.type);
  assert.equal(JSON.stringify(projected).includes(body), false);
  if (mode === NativeEventFixture.ClaudePartial) {
    assert.equal(metadata.activity, NativeEventActivity.Partial);
    assert.deepEqual(metadata.tools, []);
  } else {
    assert.equal(metadata.tools.length, 1);
    assert.equal(
      metadata.tools[0]?.call_id,
      mode === NativeEventFixture.ClaudeStructured ? null : "native-call",
    );
    assert.equal(
      metadata.tools[0]?.tool,
      [
        NativeEventFixture.Codex,
        NativeEventFixture.CodexStarted,
        NativeEventFixture.CodexUpdated,
        NativeEventFixture.ClaudeUse,
      ].includes(mode)
        ? KnowledgeTool.Get
        : NativeToolAudit.Unknown,
    );
    const activity =
      mode === NativeEventFixture.CodexStarted || mode === NativeEventFixture.ClaudeUse
        ? NativeEventActivity.Intent
        : mode === NativeEventFixture.CodexUpdated
          ? NativeEventActivity.Progress
          : NativeEventActivity.Result;
    assert.equal(metadata.activity, activity);
  }
  return true;
}
