import type {
  HookCallback,
  HookCallbackMatcher,
  Options,
  PreToolUseHookSpecificOutput,
} from "@anthropic-ai/claude-agent-sdk";
import {
  ClaudeEventKind,
  ClaudeOutputTool,
  ClaudePermission,
  type SdkArgumentField,
} from "@titan/constants";
import { ClaudeMessage } from "@titan/messages";
import type { AgentFileScope, NativeToolBinding } from "@titan/types";
import { claudeNativeAllowed } from "./native-tools.ts";
import { claudeToolAllowed } from "./permissions.ts";

export function claudeHooks(
  cwd: string,
  tools: readonly string[],
  signal: AbortSignal,
  binding?: NativeToolBinding,
  scope?: AgentFileScope,
): NonNullable<Options[SdkArgumentField.Hooks]> {
  const callback: HookCallback = async (input, _id, options) => {
    const active = AbortSignal.any([signal, options.signal]);
    if (input.hook_event_name !== ClaudeEventKind.PreToolUse)
      throw new Error(ClaudeMessage.UnexpectedHook);
    const allowed =
      !active.aborted &&
      (input.tool_name === ClaudeOutputTool ||
        claudeNativeAllowed(binding, input.tool_name) ||
        (tools.includes(input.tool_name) &&
          (await claudeToolAllowed(cwd, input.tool_name, input.tool_input, scope))));
    const decision: PreToolUseHookSpecificOutput = {
      hookEventName: ClaudeEventKind.PreToolUse,
      permissionDecision:
        allowed && !active.aborted ? ClaudePermission.Allow : ClaudePermission.Deny,
      permissionDecisionReason: ClaudeMessage.WorkspacePolicy,
    };
    return { hookSpecificOutput: decision };
  };
  const hook: HookCallbackMatcher = { onFailure: ClaudePermission.Block, hooks: [callback] };
  return { PreToolUse: [hook] };
}

export function claudePermission(
  cwd: string,
  tools: readonly string[],
  signal: AbortSignal,
  binding?: NativeToolBinding,
  scope?: AgentFileScope,
): NonNullable<Options[SdkArgumentField.CanUseTool]> {
  return async (name, input, options) => {
    const active = AbortSignal.any([signal, options.signal]);
    if (active.aborted)
      return { behavior: ClaudePermission.Deny, message: ClaudeMessage.ToolDenied };
    if (name === ClaudeOutputTool || claudeNativeAllowed(binding, name))
      return { behavior: ClaudePermission.Allow, updatedInput: input };
    if (!tools.includes(name))
      return { behavior: ClaudePermission.Deny, message: ClaudeMessage.ToolDenied };
    return (await claudeToolAllowed(cwd, name, input, scope)) && !active.aborted
      ? { behavior: ClaudePermission.Allow, updatedInput: input }
      : { behavior: ClaudePermission.Deny, message: ClaudeMessage.PathDenied };
  };
}
