import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const value = (flag) =>
  args.find((entry) => entry.startsWith(`${flag}=`))?.slice(flag.length + 1) ??
  args[args.indexOf(flag) + 1];
assert.equal(value("--tools"), "Bash");
assert.equal(value("--permission-mode"), "default");
assert.equal(value("--setting-sources"), "");
assert.equal(value("--model"), "stub-model");
assert.equal(value("--max-turns"), "3");
assert.equal(value("--input-format"), "stream-json");
assert.equal(value("--output-format"), "stream-json");
assert.ok(args.includes("--strict-mcp-config"));
let hook;
let input;
let refused;
let updated;
let phase = "initialize";
const session = "scoped-shell-session";
const emit = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  assert.ok(Buffer.byteLength(line) < 262144);
  const message = JSON.parse(line);
  if (phase === "initialize") {
    assert.equal(message.type, "control_request");
    assert.equal(message.request.subtype, "initialize");
    assert.deepEqual(message.request.systemPrompt, ["Transport contract role"]);
    const registered = message.request.hooks.PreToolUse[0];
    assert.equal(registered.onFailure, "block");
    assert.equal(registered.hookCallbackIds.length, 1);
    hook = registered.hookCallbackIds[0];
    emit({
      type: "control_response",
      response: {
        subtype: "success",
        request_id: message.request_id,
        response: {
          commands: [],
          models: [],
          hook_on_failure_supported: true,
          hooks_applied: true,
        },
      },
    });
    phase = "user";
    continue;
  }
  if (phase === "user") {
    assert.equal(message.type, "user");
    const content = message.message.content;
    const text = typeof content === "string" ? content : content[0].text;
    const task = JSON.parse(text);
    input = { command: task.command, timeout: 1000 };
    refused = task.refused;
    emit({ type: "system", subtype: "init", session_id: session });
    emit({
      type: "control_request",
      request_id: "hook",
      request: {
        subtype: "hook_callback",
        callback_id: hook,
        tool_use_id: "shell",
        input: {
          hook_event_name: "PreToolUse",
          session_id: session,
          cwd: process.cwd(),
          transcript_path: "unused",
          tool_name: "Bash",
          tool_input: input,
          tool_use_id: "shell",
        },
      },
    });
    phase = "hook";
    continue;
  }
  assert.equal(message.type, "control_response");
  assert.equal(message.response.subtype, "success");
  assert.equal(message.response.request_id, phase);
  const response = message.response.response;
  if (phase === "hook") {
    const result = response.hookSpecificOutput;
    assert.equal(result.permissionDecision, refused ? "deny" : "allow");
    updated = refused ? input : result.updatedInput;
    if (!refused) {
      assert.equal(updated.timeout, 1000);
      assert.notEqual(updated.command, input.command);
      assert.ok(updated.command.startsWith(`'${process.execPath}' `));
      const settings = updated.command.match(/'--settings' '([^']+)' '-c'/)?.[1];
      assert.ok(settings);
      const policy = JSON.parse(await readFile(settings, "utf8"));
      assert.deepEqual(policy.filesystem.allowWrite, [
        { path: `${process.cwd()}/allowed.txt`, literal: true },
      ]);
      assert.ok(
        policy.filesystem.denyWrite.some((entry) => entry.path === "/tmp/claude" && entry.literal),
      );
      assert.deepEqual(policy.network.allowedDomains, []);
    }
    emit({
      type: "control_request",
      request_id: "permission",
      request: { subtype: "can_use_tool", tool_name: "Bash", input: updated, tool_use_id: "shell" },
    });
    phase = "permission";
    continue;
  }
  assert.equal(phase, "permission");
  assert.equal(response.behavior, refused ? "deny" : "allow");
  if (!refused) assert.deepEqual(response.updatedInput, updated);
  emit({
    type: "result",
    subtype: "success",
    session_id: session,
    is_error: false,
    result: "done",
    structured_output: { ok: true, marker: "scoped", turn: 1 },
    modelUsage: { stub: { inputTokens: 4, outputTokens: 2 } },
    total_cost_usd: 0,
    permission_denials: [],
    num_turns: 1,
  });
  break;
}
process.stdin.destroy();
