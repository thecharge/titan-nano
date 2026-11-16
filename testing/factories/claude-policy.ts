import { strict as assert } from "node:assert";
import { link, mkdir, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ClaudeBackend } from "@titan/backend-claude";
import {
  ClaudeEventKind,
  ClaudePermission,
  FileAccessMode,
  NativeStreamOutcome,
  type SdkArgumentField,
  SymlinkFixture,
} from "@titan/constants";
import { agentSpec } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { AgentFileScope, AgentSpec } from "@titan/types";

export async function claudeToolPolicy(
  requested: string[],
  writable: boolean,
  probe: string,
  mutate = false,
  input: unknown = { file_path: "inside.txt" },
  linked: SymlinkFixture = SymlinkFixture.None,
  scope?: AgentFileScope,
  resumed = false,
  event: string = ClaudeEventKind.PreToolUse,
  structured = true,
  stopped: NativeStreamOutcome = NativeStreamOutcome.Complete,
) {
  return withTemporaryDirectory(async (root) => {
    const cwd = await policyWorkspace(root, linked);
    let captured:
      | Parameters<
          NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>
        >[0][SdkArgumentField.Options]
      | undefined;
    const backend = new ClaudeBackend(({ options }) => {
      captured = options;
      return Object.assign(
        (async function* () {
          yield {
            type: "result",
            subtype: "success",
            session_id: "policy-session",
            is_error: false,
            result: "done",
            structured_output: null,
            modelUsage: {},
            total_cost_usd: 0,
            permission_denials: [],
          };
        })(),
        { close() {} },
      ) as ReturnType<NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>>;
    });
    const tools = [...requested];
    const spec: AgentSpec = {
      ...agentSpec(cwd),
      tools,
      writable,
      ...(scope ? { file_scope: scope } : {}),
    };
    if (!structured) spec.output_schema = null;
    const session = resumed
      ? await backend.resume("policy-session", spec)
      : await backend.start(spec);
    try {
      if (mutate) {
        tools.push(probe);
        scope?.paths.push("other.txt");
      }
      const controller = new AbortController();
      const signal = controller.signal;
      await session.send("task", async () => {}, signal);
      const hook = captured?.hooks?.PreToolUse?.[0]?.hooks[0];
      if (!captured?.canUseTool || !hook) throw new Error("Missing policy callbacks");
      assert.equal(captured.strictMcpConfig, true);
      assert.deepEqual(captured.mcpServers, {});
      assert.deepEqual(captured.settingSources, []);
      const hookInput: Parameters<typeof hook>[0] = {
        session_id: "policy-session",
        transcript_path: "unused",
        cwd,
        hook_event_name: ClaudeEventKind.PreToolUse,
        tool_name: probe,
        tool_input: input as Record<string, unknown>,
        tool_use_id: "policy-call",
      };
      Reflect.set(hookInput, "hook_event_name", event);
      if (stopped === NativeStreamOutcome.Close) await session.close();
      if (stopped === NativeStreamOutcome.Cancel) await session.cancel("Stopped policy owner");
      if (stopped === NativeStreamOutcome.Abort) controller.abort();
      const hookResult = await hook(hookInput, "policy-call", { signal });
      const permission = await captured.canUseTool(probe, input as Record<string, unknown>, {
        signal,
        toolUseID: "policy-call",
        requestId: "policy-request",
      });
      return { tools: captured.tools, hook: hookResult, permission };
    } finally {
      await session.close();
    }
  });
}

async function policyWorkspace(root: string, linked: SymlinkFixture): Promise<string> {
  const cwd = resolve(root, "workspace");
  if (linked === SymlinkFixture.Root) {
    const actual = resolve(root, "actual");
    await mkdir(actual);
    await symlink(actual, cwd);
    return cwd;
  }
  await mkdir(cwd);
  await writeFile(resolve(cwd, "inside.txt"), Buffer.from("inside fixture"));
  if (linked !== SymlinkFixture.None) {
    const outside = resolve(root, "outside");
    await mkdir(outside);
    await writeFile(resolve(outside, "secret"), Buffer.from("outside fixture"));
    if (linked === SymlinkFixture.HardLink) {
      await link(resolve(outside, "secret"), resolve(cwd, "link"));
      return cwd;
    }
    let target = outside;
    if (linked === SymlinkFixture.Dangling) target = resolve(outside, "missing");
    if (linked === SymlinkFixture.Inside) target = resolve(cwd, "inside.txt");
    if (linked === SymlinkFixture.InsideDirectory) {
      target = resolve(cwd, "src");
      await mkdir(target);
    }
    await symlink(target, resolve(cwd, "link"));
  }
  return cwd;
}

export async function claudePathPolicy(
  tool: string,
  input: unknown,
  linked: SymlinkFixture = SymlinkFixture.None,
) {
  const result = await claudeToolPolicy([tool], true, tool, false, input, linked);
  const hook = "hookSpecificOutput" in result.hook ? result.hook.hookSpecificOutput : undefined;
  return {
    hookAllowed:
      hook?.hookEventName === ClaudeEventKind.PreToolUse &&
      hook.permissionDecision === ClaudePermission.Allow,
    permissionAllowed: result.permission?.behavior === ClaudePermission.Allow,
  };
}

export async function claudeScopedWrite(
  tool: string,
  path: string,
  paths: string[],
  readonly: boolean,
  mutate = false,
  resumed = false,
  excluded: string[] = [],
) {
  const result = await claudeToolPolicy(
    [tool],
    true,
    tool,
    mutate,
    { file_path: path },
    SymlinkFixture.None,
    {
      mode: readonly ? FileAccessMode.Read : FileAccessMode.Write,
      paths,
      ...(excluded.length ? { exclude_paths: excluded } : {}),
    },
    resumed,
  );
  const hook = "hookSpecificOutput" in result.hook ? result.hook.hookSpecificOutput : undefined;
  return {
    hookAllowed:
      hook?.hookEventName === ClaudeEventKind.PreToolUse &&
      hook.permissionDecision === ClaudePermission.Allow,
    permissionAllowed: result.permission?.behavior === ClaudePermission.Allow,
  };
}

export async function claudeStoppedPolicy(
  tool: string,
  stopped: NativeStreamOutcome,
  resumed: boolean,
) {
  const result = await claudeToolPolicy(
    [tool],
    true,
    tool,
    false,
    { file_path: "inside.txt" },
    SymlinkFixture.None,
    undefined,
    resumed,
    ClaudeEventKind.PreToolUse,
    true,
    stopped,
  );
  const hook = "hookSpecificOutput" in result.hook ? result.hook.hookSpecificOutput : undefined;
  return {
    hookAllowed:
      hook?.hookEventName === ClaudeEventKind.PreToolUse &&
      hook.permissionDecision === ClaudePermission.Allow,
    permissionAllowed: result.permission?.behavior === ClaudePermission.Allow,
  };
}
