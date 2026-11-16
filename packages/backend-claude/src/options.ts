import type {
  HookCallback,
  HookCallbackMatcher,
  Options,
  PreToolUseHookSpecificOutput,
} from "@anthropic-ai/claude-agent-sdk";
import {
  AgentTool,
  ClaudeEventKind,
  ClaudeOutputTool,
  ClaudePermission,
  type SdkArgumentField,
} from "@titan/constants";
import { ClaudeMessage } from "@titan/messages";
import { type AgentFileScope, type NativeToolBinding, ObjectSchema } from "@titan/types";
import { claudeNativeAllowed } from "./native-tools.ts";
import { claudeToolAllowed } from "./permissions.ts";
import type { ClaudeShellSandbox } from "./sandbox.ts";

export function claudeHooks(
  cwd: string,
  tools: readonly string[],
  signal: AbortSignal,
  binding?: NativeToolBinding,
  scope?: AgentFileScope,
  sandbox?: ClaudeShellSandbox,
): NonNullable<Options[SdkArgumentField.Hooks]> {
  const callback: HookCallback = async (input, _id, options) => {
    const active = AbortSignal.any([signal, options.signal]);
    if (input.hook_event_name !== ClaudeEventKind.PreToolUse)
      throw new Error(ClaudeMessage.UnexpectedHook);
    const updated = active.aborted
      ? undefined
      : await toolInput(cwd, tools, input.tool_name, input.tool_input, binding, scope, sandbox);
    const allowed = updated !== undefined;
    const decision: PreToolUseHookSpecificOutput = {
      hookEventName: ClaudeEventKind.PreToolUse,
      permissionDecision:
        allowed && !active.aborted ? ClaudePermission.Allow : ClaudePermission.Deny,
      permissionDecisionReason: ClaudeMessage.WorkspacePolicy,
      ...(allowed && input.tool_name === AgentTool.Bash && sandbox
        ? { updatedInput: updated }
        : {}),
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
  sandbox?: ClaudeShellSandbox,
): NonNullable<Options[SdkArgumentField.CanUseTool]> {
  return async (name, input, options) => {
    const active = AbortSignal.any([signal, options.signal]);
    if (active.aborted)
      return { behavior: ClaudePermission.Deny, message: ClaudeMessage.ToolDenied };
    if (name !== ClaudeOutputTool && !claudeNativeAllowed(binding, name) && !tools.includes(name))
      return { behavior: ClaudePermission.Deny, message: ClaudeMessage.ToolDenied };
    const updated = await toolInput(cwd, tools, name, input, binding, scope, sandbox);
    return updated !== undefined && !active.aborted
      ? { behavior: ClaudePermission.Allow, updatedInput: updated }
      : { behavior: ClaudePermission.Deny, message: ClaudeMessage.PathDenied };
  };
}

async function toolInput(
  cwd: string,
  tools: readonly string[],
  name: string,
  input: unknown,
  binding?: NativeToolBinding,
  scope?: AgentFileScope,
  sandbox?: ClaudeShellSandbox,
) {
  if (name === ClaudeOutputTool || claudeNativeAllowed(binding, name))
    return ObjectSchema.parse(input);
  if (!tools.includes(name)) return undefined;
  if (name === AgentTool.Bash && sandbox?.known(input)) return ObjectSchema.parse(input);
  if (!(await claudeToolAllowed(cwd, name, input, scope))) return undefined;
  return name === AgentTool.Bash && sandbox ? sandbox.wrap(input) : ObjectSchema.parse(input);
}
