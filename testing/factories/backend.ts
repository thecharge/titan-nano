import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { CodexBackend } from "@titan/backend-codex";
import { FakeBackend, ScriptedFakeBackend } from "@titan/backend-fake";
import { resolveConfig, workflowSettings } from "@titan/config";
import { AgentHost, CancellationBoundary, ErrorCode, IoLimit } from "@titan/constants";
import { agentSpec } from "@titan/test-factories";
import { processExited, thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  AgentEventSchema,
  AgentSpecSchema,
  FakeInvocationSchema,
  FakeScriptSchema,
  NativeCodexCommandEventSchema,
} from "@titan/types";

export function personaInvocation(persona: string): boolean {
  return (
    AgentSpecSchema.safeParse({ ...agentSpec("/tmp"), persona_id: persona }).success &&
    FakeInvocationSchema.safeParse({ persona_id: persona, attempt: 1, execution: 1 }).success
  );
}

export async function fakeCancellation(resume: boolean, cancelled: boolean, preAborted: boolean) {
  let called = 0;
  let events = 0;
  const backend = new FakeBackend(async () => {
    called++;
    return { json: { done: true } };
  });
  const spec = AgentSpecSchema.parse({
    run_id: "run",
    invocation_id: "worker",
    execution_id: "execution",
    cwd: "/tmp",
    role: "Test",
    model: null,
    tools: [],
    output_schema: null,
    writable: false,
    max_turns: 1,
  });
  const session = resume ? await backend.resume("native", spec) : await backend.start(spec);
  const signal = new AbortController();
  if (preAborted) signal.abort(new Error("Stopped before send"));
  if (cancelled) await session.cancel("Stopped session");
  const error = await thrownBy(async () =>
    session.send(
      "work",
      async () => {
        events++;
      },
      signal.signal,
    ),
  );
  await session.close();
  return { called, events, failed: error instanceof Error };
}

export async function codexCancellation(
  resume: boolean,
  boundary: CancellationBoundary,
  internal: boolean,
) {
  let started = 0;
  let events = 0;
  const controller = new AbortController();
  let stop = async () => controller.abort(new Error("Stopped invocation"));
  const thread = {
    async runStreamed() {
      started++;
      return {
        events: (async function* () {
          if (boundary === CancellationBoundary.BeforeEvent) await stop();
          yield { type: "thread.started", thread_id: "native" };
          yield { type: "item.completed", item: { type: "agent_message", text: "done" } };
          yield { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } };
          if (boundary === CancellationBoundary.StreamEnd) await stop();
        })(),
      };
    },
  };
  const backend = new CodexBackend({
    startThread() {
      return thread;
    },
    resumeThread() {
      return thread;
    },
  } as unknown as NonNullable<ConstructorParameters<typeof CodexBackend>[0]>);
  const spec = AgentSpecSchema.parse({
    run_id: "run",
    invocation_id: "worker",
    execution_id: "execution",
    cwd: "/tmp",
    role: "Test",
    model: null,
    tools: [],
    output_schema: null,
    writable: false,
    max_turns: 1,
  });
  const session = resume ? await backend.resume("native", spec) : await backend.start(spec);
  if (internal) stop = async () => session.cancel("Stopped session");
  if (boundary === CancellationBoundary.BeforeSend) await stop();
  const error = await thrownBy(async () =>
    session.send(
      "work",
      async () => {
        events++;
        if (boundary === CancellationBoundary.ResultHandler && events === 3) await stop();
      },
      controller.signal,
    ),
  );
  await session.close();
  return { started, events, failed: error instanceof Error };
}

export async function processObservation(exited: boolean, attempts: number) {
  const child = Bun.spawn([process.execPath, "-e", "process.exit(0)"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await child.exited;
  return waitUntil(async () => processExited(exited ? child.pid : process.pid), attempts);
}

export async function scriptedFake(
  script: unknown,
  persona: string,
  task: string,
  attempt = 1,
  execution = 1,
  resume = false,
) {
  const source = FakeScriptSchema.parse(script);
  const backend = new ScriptedFakeBackend(source);
  for (const entry of source.answers) entry.answer = { marker: "caller mutation" };
  const spec = { ...agentSpec("/tmp"), persona_id: persona, attempt, execution };
  const prompt = JSON.stringify({ task });
  await backend.validateTurn(spec, prompt);
  const session = resume ? await backend.resume("native", spec) : await backend.start(spec);
  try {
    const result = await session.send(prompt, async () => {}, new AbortController().signal);
    if (resume) assert.equal(result.session_id, "native");
    const answer = structuredClone(result.json);
    Reflect.set(Object(result.json), "marker", "returned mutation");
    const repeated = await session.send(prompt, async () => {}, new AbortController().signal);
    assert.deepEqual(repeated.json, answer);
    return answer;
  } finally {
    await session.close();
  }
}

export async function fakeScriptAdmission(script: unknown) {
  new ScriptedFakeBackend(script);
  return true;
}

export async function fakeScriptPrompt(spec: unknown, prompt: string) {
  const backend = new ScriptedFakeBackend({ version: 1, answers: [] });
  const error = await thrownBy(() => backend.validateTurn(AgentSpecSchema.parse(spec), prompt));
  if (Reflect.get(Object(error), "code") !== ErrorCode.FakeUnscripted) throw error;
  return true;
}

export async function configuredFakeScript(script: unknown) {
  return withTemporaryDirectory(async (root) => {
    const fake = { script };
    const backends = { fake };
    const config = await resolveConfig({
      home: resolve(root, "home"),
      project: root,
      workflow: workflowSettings({ backends }),
    });
    assert.ok(config.hash);
    assert.deepEqual(config.value.backends?.fake?.script, FakeScriptSchema.parse(script));
    return true;
  });
}

export async function codexCommandTelemetry(resume: boolean, character: string, size: number) {
  const output = character.repeat(size);
  const events: unknown[] = [];
  const thread = {
    async runStreamed() {
      return {
        events: (async function* () {
          yield { type: "thread.started", thread_id: "native" };
          yield {
            type: "item.completed",
            item: {
              id: "command",
              type: "command_execution",
              command: output,
              aggregated_output: output,
              status: "completed",
              exit_code: 0,
            },
          };
          yield { type: "item.completed", item: { type: "agent_message", text: "done" } };
          yield { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } };
        })(),
      };
    },
  };
  const backend = new CodexBackend({
    startThread: () => thread,
    resumeThread: () => thread,
  } as unknown as NonNullable<ConstructorParameters<typeof CodexBackend>[0]>);
  const spec = AgentSpecSchema.parse({ ...agentSpec("/tmp"), output_schema: null });
  const session = resume ? await backend.resume("native", spec) : await backend.start(spec);
  try {
    const answer = await session.send(
      "work",
      async (event) => {
        events.push(event);
      },
      new AbortController().signal,
    );
    const commandEvent = AgentEventSchema.parse(events[1]);
    const command = NativeCodexCommandEventSchema.parse(commandEvent.data);
    assert.equal(answer.text, "done");
    assert.equal(command.item.exit_code, 0);
    assert.ok(
      Buffer.byteLength(JSON.stringify({ type: "event", event: commandEvent })) <
        AgentHost.MessageBytes,
    );
    assert.equal(command.item.command, command.item.aggregated_output);
    if (Buffer.byteLength(output) <= IoLimit.ChunkBytes)
      assert.equal(command.item.aggregated_output, output);
    else {
      assert.ok(
        command.item.aggregated_output.includes(createHash("sha256").update(output).digest("hex")),
      );
      assert.ok(command.item.aggregated_output.startsWith(output.slice(0, IoLimit.ChunkBytes)));
    }
    return true;
  } finally {
    await session.close();
  }
}
