import { ClaudeBackend } from "@titan/backend-claude";
import { ClaudeEventKind } from "@titan/constants";
import { agentSpec } from "@titan/test-factories";

export async function claudeDenials(count: number, failed: boolean) {
  const denial = { tool_name: "Bash", tool_use_id: "call", tool_input: { command: "git status" } };
  const final = {
    type: ClaudeEventKind.Result,
    subtype: ClaudeEventKind.Success,
    session_id: "denials",
    is_error: failed,
    result: "done",
    structured_output: null,
    modelUsage: { stub: { inputTokens: 1, outputTokens: 1 } },
    total_cost_usd: 0,
    permission_denials: Array.from({ length: count }, () => denial),
    num_turns: 1,
  };
  const backend = new ClaudeBackend(
    () =>
      Object.assign(
        (async function* () {
          yield final;
        })(),
        { close() {} },
      ) as ReturnType<NonNullable<ConstructorParameters<typeof ClaudeBackend>[0]>>,
  );
  const session = await backend.start(agentSpec(process.cwd()));
  const answer = await session.send("denials", async () => {}, new AbortController().signal);
  return answer.text;
}
