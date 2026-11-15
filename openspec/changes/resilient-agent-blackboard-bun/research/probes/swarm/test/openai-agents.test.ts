// Probe of @openai/agents 0.21.0 with a scripted fake model. No network, no key.
import { expect, test } from "bun:test";
import {
  Agent,
  InputGuardrailTripwireTriggered,
  MaxTurnsExceededError,
  type Model,
  type ModelRequest,
  type ModelResponse,
  Runner,
  Usage,
  tool,
} from "@openai/agents";
import { z } from "zod";

type Step = (req: ModelRequest) => ModelResponse["output"];

// A fake model: each call takes the next scripted step. It counts its calls.
class FakeModel implements Model {
  calls = 0;
  constructor(private steps: Step[]) {}
  async getResponse(req: ModelRequest): Promise<ModelResponse> {
    const step = this.steps[this.calls];
    this.calls++;
    if (!step) throw new Error(`fake model has no script for call ${this.calls}`);
    return { usage: new Usage({ requests: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15 }), output: step(req) };
  }
  // biome-ignore lint/correctness/useYield: not used in this probe
  async *getStreamedResponse(): AsyncIterable<never> {
    throw new Error("not used");
  }
}

const say = (text: string): Step => () => [
  { type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] },
];
const call = (name: string, args: object, id = `c-${name}`): Step => () => [
  { type: "function_call", callId: id, name, arguments: JSON.stringify(args), status: "completed" },
];

const runner = () => new Runner({ tracingDisabled: true });

test("handoff: the model calls transfer_to_<agent>, and the other agent answers", async () => {
  const refundModel = new FakeModel([say("refund done")]);
  const refund = new Agent({ name: "refund_agent", instructions: "refunds", model: refundModel });
  let seenTools: string[] = [];
  const triageModel = new FakeModel([
    (req) => {
      seenTools = req.handoffs.map((h) => h.toolName);
      return call("transfer_to_refund_agent", {})(req);
    },
  ]);
  const triage = new Agent({ name: "triage", instructions: "route", model: triageModel, handoffs: [refund] });
  const result = await runner().run(triage, "I want a refund");
  console.log("handoff tool names seen by the model:", seenTools);
  console.log("last agent:", result.lastAgent?.name, "| final output:", result.finalOutput);
  expect(seenTools).toEqual(["transfer_to_refund_agent"]);
  expect(result.lastAgent?.name).toBe("refund_agent");
  expect(result.finalOutput).toBe("refund done");
});

test("agent as tool: the specialist answers, and the first agent keeps control", async () => {
  const spec = new Agent({ name: "spec", instructions: "x", model: new FakeModel([say("42")]) });
  const mainModel = new FakeModel([call("ask_spec", { input: "q" }), say("the answer is 42")]);
  const main = new Agent({
    name: "main",
    instructions: "y",
    model: mainModel,
    tools: [spec.asTool({ toolName: "ask_spec", toolDescription: "ask the specialist" })],
  });
  const result = await runner().run(main, "go");
  console.log("agent-as-tool last agent:", result.lastAgent?.name, "| output:", result.finalOutput);
  expect(result.lastAgent?.name).toBe("main");
  expect(result.finalOutput).toBe("the answer is 42");
});

for (const runInParallel of [false, true]) {
  test(`input guardrail tripwire with runInParallel=${runInParallel}: model calls before the stop`, async () => {
    const model = new FakeModel([say("should not matter")]);
    const agent = new Agent({
      name: "guarded",
      instructions: "z",
      model,
      inputGuardrails: [
        {
          name: "no-secrets",
          runInParallel,
          execute: async () => {
            await Bun.sleep(30); // the guard is slower than the fake model
            return { tripwireTriggered: true, outputInfo: "blocked" };
          },
        },
      ],
    });
    let err: unknown;
    try {
      await runner().run(agent, "my key is sk-123");
    } catch (e) {
      err = e;
    }
    console.log(`runInParallel=${runInParallel}: error=${(err as Error)?.constructor?.name}, fake model calls=${model.calls}`);
    expect(err).toBeInstanceOf(InputGuardrailTripwireTriggered);
    if (!runInParallel) expect(model.calls).toBe(0);
  });
}

test("maxTurns: a model that keeps calling a tool stops with MaxTurnsExceededError", async () => {
  let toolRuns = 0;
  const ping = tool({
    name: "ping",
    description: "ping",
    parameters: z.object({}),
    execute: async () => {
      toolRuns++;
      return "pong";
    },
  });
  const loop: Step[] = Array.from({ length: 20 }, (_, i) => call("ping", {}, `c${i}`));
  const agent = new Agent({ name: "looper", instructions: "loop", model: new FakeModel(loop), tools: [ping] });
  let err: unknown;
  try {
    await runner().run(agent, "go", { maxTurns: 3 });
  } catch (e) {
    err = e;
  }
  console.log("maxTurns=3:", (err as Error)?.constructor?.name, "| tool runs:", toolRuns);
  expect(err).toBeInstanceOf(MaxTurnsExceededError);
});
