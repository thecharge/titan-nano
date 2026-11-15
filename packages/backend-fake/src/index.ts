import {
  AgentEventKind,
  Backend,
  BackendContractVersion,
  ErrorCode,
  IoLimit,
  TextSymbol,
} from "@titan/constants";
import { emptyUsage, jsonByteLength, newId } from "@titan/core";
import { OperationalError, TitanError } from "@titan/errors";
import { FakeMessage, unscriptedFakeTask } from "@titan/messages";
import {
  type AgentBackend,
  type AgentSession,
  type AgentSpec,
  type FakeHandler,
  FakeInvocationSchema,
  FakePromptSchema,
  type FakeScript,
  FakeScriptSchema,
} from "@titan/types";
export class FakeBackend implements AgentBackend {
  readonly id = Backend.Fake;
  readonly specificationVersion = BackendContractVersion;
  readonly capabilities = { resume: true, builtinTools: true, structuredOutput: true };
  constructor(private handler: FakeHandler = unscriptedAnswer) {}
  private session(spec: AgentSpec, id: string): AgentSession {
    const controller = new AbortController();
    return {
      send: async (prompt, sink, signal) => {
        const combined = AbortSignal.any([signal, controller.signal]);
        combined.throwIfAborted();
        await sink({ type: AgentEventKind.Session, session_id: id, data: { stub: true } });
        const answer = await this.handler(spec, prompt, combined, sink);
        combined.throwIfAborted();
        return {
          text: TextSymbol.Empty,
          json: null,
          session_id: id,
          usage: emptyUsage(),
          ...answer,
        };
      },
      async cancel(reason) {
        controller.abort(new Error(reason));
      },
      async close() {
        controller.abort();
      },
    };
  }
  async validateTurn(spec: AgentSpec, prompt: string): Promise<void> {
    if (this.handler === unscriptedAnswer) await unscriptedAnswer(spec, prompt);
  }
  async start(spec: AgentSpec): Promise<AgentSession> {
    return this.session(spec, newId());
  }
  async resume(id: string, spec: AgentSpec): Promise<AgentSession> {
    return this.session(spec, id);
  }
}

async function unscriptedAnswer(_spec: AgentSpec, prompt: string): Promise<never> {
  throw new OperationalError(ErrorCode.FakeUnscripted, unscriptedFakeTask(promptTask(prompt)));
}

function promptTask(prompt: string): string {
  if (Buffer.byteLength(prompt) > IoLimit.DataBytes)
    throw new OperationalError(ErrorCode.FakeScript, FakeMessage.InvalidPrompt);
  try {
    return FakePromptSchema.parse(JSON.parse(prompt)).task;
  } catch {
    throw new OperationalError(ErrorCode.FakeScript, FakeMessage.InvalidPrompt);
  }
}

function answerScript(value: unknown): FakeScript {
  try {
    jsonByteLength(value, IoLimit.DataBytes);
    const script = FakeScriptSchema.parse(value);
    jsonByteLength(script, IoLimit.DataBytes);
    return script;
  } catch {
    throw new TitanError(ErrorCode.FakeScript, FakeMessage.InvalidScript);
  }
}

function scriptedAnswer(script: FakeScript, spec: AgentSpec, prompt: string): unknown {
  const invocation = FakeInvocationSchema.safeParse(spec);
  if (!invocation.success)
    throw new OperationalError(ErrorCode.FakeScript, FakeMessage.InvalidPrompt);
  const task = promptTask(prompt);
  const entry = script.answers.find(
    (candidate) =>
      candidate.persona === invocation.data.persona_id &&
      candidate.task === task &&
      candidate.attempt === invocation.data.attempt &&
      candidate.execution === invocation.data.execution,
  );
  if (!entry) throw new OperationalError(ErrorCode.FakeUnscripted, unscriptedFakeTask(task));
  return structuredClone(entry.answer);
}

export class ScriptedFakeBackend extends FakeBackend {
  private readonly script: FakeScript;

  constructor(value: unknown) {
    const script = answerScript(value);
    super(async (spec, prompt) => ({ json: scriptedAnswer(script, spec, prompt) }));
    this.script = script;
  }

  async validateTurn(spec: AgentSpec, prompt: string): Promise<void> {
    scriptedAnswer(this.script, spec, prompt);
  }
}
