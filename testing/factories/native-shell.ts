import { strict as assert } from "node:assert";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeBackend } from "@titan/backend-claude";
import {
  AgentRuntime,
  AgentTool,
  ClaudeEventKind,
  FileAccessMode,
  type SdkArgumentField,
} from "@titan/constants";
import { agentSpec } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ObjectSchema } from "@titan/types";
import { claude, result } from "./adapter-contract.ts";

export function nativeShellSdk(command: string, refused: boolean) {
  return withTemporaryDirectory(async (project) => {
    await writeFile(resolve(project, "allowed.txt"), "Original");
    const backend = new ClaudeBackend(query, {
      executable: resolve(import.meta.dir, "../fixtures/claude-shell-0.3.319.mjs"),
      runtime: AgentRuntime.Bun,
    });
    const session = await backend.start({
      ...agentSpec(project),
      tools: [AgentTool.Bash],
      writable: true,
      file_scope: { mode: FileAccessMode.Write, paths: ["allowed.txt"] },
    });
    try {
      const answer = await session.send(
        JSON.stringify({ command, refused }),
        async () => {},
        new AbortController().signal,
      );
      assert.deepEqual(answer.json, { ok: true, marker: "scoped", turn: 1 });
      return true;
    } finally {
      await session.close();
    }
  });
}

export function nativeShellBoundary(
  command: string,
  paths: string[],
  refused = false,
  capacity: boolean | string = false,
) {
  return withTemporaryDirectory(async (project) => {
    await mkdir(resolve(project, ".git"));
    await writeFile(resolve(project, ".git/config"), "Protected");
    await writeFile(resolve(project, "allowed.txt"), "Original");
    await writeFile(resolve(project, "outside.txt"), "Outside");
    if (capacity === "initialization") await symlink("allowed.txt", resolve(project, "linked.txt"));
    let captured: Parameters<
      NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>
    >[0][SdkArgumentField.Options];
    const backend = new ClaudeBackend(
      claude([result], (options) => {
        captured = options;
      }),
    );
    const session = await backend.start({
      ...agentSpec(project),
      tools: [AgentTool.Bash, AgentTool.Write],
      writable: true,
      file_scope: { mode: FileAccessMode.Write, paths },
    });
    const signal = new AbortController().signal;
    try {
      await session.send("task", async () => {}, signal);
      const hook = captured?.hooks?.PreToolUse?.[0]?.hooks[0];
      const permission = captured?.canUseTool;
      assert.ok(hook && permission);
      const input = { command, timeout: 1000 };
      if (capacity === "initialization") {
        await assert.rejects(() =>
          permission(AgentTool.Bash, input, { signal, toolUseID: "shell", requestId: "shell" }),
        );
        return true;
      }
      const decision = await hook(
        {
          hook_event_name: ClaudeEventKind.PreToolUse,
          session_id: "shell",
          cwd: project,
          transcript_path: "unused",
          tool_name: AgentTool.Bash,
          tool_input: input,
          tool_use_id: "shell",
        },
        undefined,
        { signal },
      );
      const output = ObjectSchema.parse(
        Reflect.get(ObjectSchema.parse(decision), "hookSpecificOutput"),
      );
      assert.equal(output.permissionDecision, refused ? "deny" : "allow");
      if (refused) return true;
      const updated = ObjectSchema.parse(output.updatedInput);
      assert.equal(updated.timeout, 1000);
      assert.equal(typeof updated.command, "string");
      assert.notEqual(updated.command, command);
      const repeated = await permission(AgentTool.Bash, updated, {
        signal,
        toolUseID: "shell",
        requestId: "shell",
      });
      assert.ok(repeated);
      assert.equal(repeated.behavior, "allow");
      if (repeated.behavior === "allow") assert.deepEqual(repeated.updatedInput, updated);
      if (typeof capacity === "string") {
        await assert.rejects(async () => {
          for (let index = 0; index < 128; index++)
            await permission(
              AgentTool.Bash,
              { command: `printf ${index} ${"x".repeat(capacity === "command" ? 65536 : 64000)}` },
              { signal, toolUseID: "shell", requestId: "shell" },
            );
        });
        return true;
      }
      if (capacity) {
        for (let index = 1; index < 1024; index++)
          await permission(
            AgentTool.Bash,
            { command: `printf ${index}` },
            { signal, toolUseID: "shell", requestId: "shell" },
          );
        await assert.rejects(() =>
          permission(
            AgentTool.Bash,
            { command: "printf full" },
            { signal, toolUseID: "shell", requestId: "shell" },
          ),
        );
        return true;
      }
      const child = Bun.spawn(
        [
          process.execPath,
          resolve(import.meta.dir, "../fixtures/native-shell.mjs"),
          String(updated.command),
        ],
        {
          cwd: project,
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const error = await new Response(child.stderr).text();
      assert.equal(await child.exited, 0, error);
      const result = ObjectSchema.parse(JSON.parse(await new Response(child.stdout).text()));
      const exit = result.exit;
      const stdout = String(result.output);

      assert.equal(await readFile(resolve(project, "outside.txt"), "utf8"), "Outside");
      assert.equal(await readFile(resolve(project, ".git/config"), "utf8"), "Protected");
      assert.equal(stdout.includes("UNSANDBOXED"), false);
      if (exit !== 0)
        assert.equal(await readFile(resolve(project, "allowed.txt"), "utf8"), "Original");
      return true;
    } finally {
      await session.close();
    }
  });
}
