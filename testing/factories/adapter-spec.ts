import { strict as assert } from "node:assert";
import { ClaudeBackend } from "@titan/backend-claude";
import { CodexBackend } from "@titan/backend-codex";
import { AgentTool, FalsifierOutput, StructuredOutputKind } from "@titan/constants";
import { codexPrompt } from "@titan/messages";
import { agentSpec } from "@titan/test-factories";
import type { AgentSpec } from "@titan/types";
import { claude, codex, result } from "./adapter-contract.ts";

function changeSpec(spec: AgentSpec): void {
  spec.cwd = "/tmp/changed";
  spec.role = "Changed role";
  spec.model = "changed-model";
  spec.writable = true;
  spec.tools.push(AgentTool.Write);
  spec.max_turns = 1;
  assert.ok(spec.output_schema);
  spec.output_schema.type = "null";
}

export async function claudeSpecSnapshot(mutate: boolean, resumed: boolean) {
  const spec = agentSpec("/tmp");
  const original = structuredClone(spec);
  const backend = new ClaudeBackend(
    claude([result], (options) => {
      assert.equal(options.cwd, original.cwd);
      assert.equal(options.systemPrompt, original.role);
      assert.equal(options.model, original.model ?? undefined);
      assert.equal(options.maxTurns, original.max_turns);
      assert.deepEqual(options.tools, original.tools);
      assert.deepEqual(options.outputFormat, {
        type: StructuredOutputKind.JsonSchema,
        schema: original.output_schema,
      });
    }),
  );
  const session = resumed
    ? await backend.resume("claude-session", spec)
    : await backend.start(spec);
  try {
    if (mutate) changeSpec(spec);
    await session.send("task", async () => {}, new AbortController().signal);
    return true;
  } finally {
    await session.close();
  }
}

export async function codexSpecSnapshot(mutate: boolean, resumed: boolean) {
  assert.deepEqual(
    [...FalsifierOutput.required].sort(),
    Object.keys(FalsifierOutput.properties).sort(),
  );
  const spec = agentSpec("/tmp");
  const original = structuredClone(spec);
  const capture: Record<string, unknown> = {};
  const backend = new CodexBackend(
    codex(
      [
        { type: "thread.started", thread_id: "native-1" },
        { type: "item.completed", item: { type: "agent_message", text: '{"ok":true}' } },
        { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } },
      ],
      capture,
    ),
  );
  const session = resumed ? await backend.resume("native-1", spec) : await backend.start(spec);
  try {
    if (mutate) changeSpec(spec);
    await session.send("task", async () => {}, new AbortController().signal);
    assert.equal(capture.prompt, codexPrompt(original.role, "task"));
    assert.deepEqual(Reflect.get(Object(capture.turn), "outputSchema"), original.output_schema);
    assert.equal(Reflect.get(Object(capture.options), "workingDirectory"), original.cwd);
    return true;
  } finally {
    await session.close();
  }
}
