import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  AskMode,
  Backend,
  BoardExchange,
  ErrorCode,
  ExecutionPhase,
  RequestDecision,
  RequestKind,
  RunStatus,
  Verdict,
} from "@titan/constants";
import type { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { AskExchange as Exchange, AskObserved as Observed, Run } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { legacyEngineRun } from "./legacy-run.ts";

const pairs = [...BoardExchange.Asked, BoardExchange.Direct, BoardExchange.Own];
const actor = { client_id: BoardExchange.Investigator, authority: ApprovalLevel.Main };

function describeAsk(question: string) {
  return {
    kind: RequestKind.Ask,
    scope: {
      operation: BoardExchange.Operation,
      resource: BoardExchange.Investigator,
      content_hashes: {},
      arguments: [question],
      environment_names: [],
    },
    expires_at: Date.now() + BoardExchange.ExpiresMs,
  };
}

function holdsAny(prompt: string, texts: readonly string[]): boolean {
  return texts.some((text) => prompt.includes(text));
}

async function settle(engine: Engine, run: Run, exchange: Exchange, observed: Observed) {
  for (let round = 0; round < 2 && run.state === RunStatus.Waiting; round++) {
    const phase = run.nodes[BoardExchange.StepId]?.phases[ExecutionPhase.Worker];
    observed.sessions.push(phase?.session_id);
    if (exchange.mode === AskMode.Unanswered) {
      await engine.resume(run.run_id);
      return;
    }
    const open = (await engine.requests.list(run.run_id)).filter(
      (request) => request.answer === null,
    );
    for (const request of open) {
      const asked = request.scope.arguments[0];
      const reply = pairs.find((pair) => pair.question === asked);
      assert.ok(reply);
      await engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: exchange.decision,
          reason: reply.answer,
        },
        actor,
      );
      if (exchange.mode === AskMode.Conflicting) {
        const refused = await thrownBy(() =>
          engine.requests.answer(
            {
              run_id: run.run_id,
              request_id: request.request_id,
              version: request.version + 1,
              decision: exchange.decision,
              reason: BoardExchange.Rival,
            },
            actor,
          ),
        );
        observed.codes.push(Reflect.get(Object(refused), "code"));
      }
    }
    await engine.resume(run.run_id);
  }
}

async function exchangeAtRoot(root: string, exchange: Exchange): Promise<Observed> {
  const config = await resolveConfig({
    home: resolve(root, "home"),
    project: root,
    overrides: { recovery: { max_retries: 0 }, limits: { max_parallel: 2 } },
  });
  const base = vendorRecoveryWorkflow(BoardExchange.CheckTask);
  const step = base.steps[0];
  assert.ok(step);
  const workflow = validateWorkflow({
    ...base,
    personas: {
      [BoardExchange.Fixer]: { ...base.personas.worker, request_turns: true },
      [BoardExchange.Skeptic]: { ...base.personas.checker, request_turns: true },
    },
    steps: [
      {
        ...step,
        do: { persona: BoardExchange.Fixer, task: BoardExchange.FixTask },
        falsify: [{ persona: BoardExchange.Skeptic, task: BoardExchange.CheckTask }],
      },
    ],
  });
  let engine: Engine | undefined;
  let runId: string | undefined;
  const observed: Observed = {
    fixerPrompts: [],
    skepticPrompts: [],
    sessions: [],
    run: undefined as unknown as Run,
    codes: [],
  };
  const postDirect = async () => {
    assert.ok(engine && runId);
    const request = await engine.requests.open(runId, {
      request_id: BoardExchange.DirectId,
      ...describeAsk(BoardExchange.Direct.question),
      origin: { client_id: BoardExchange.Planner, harness_session_id: null },
    });
    await engine.requests.answer(
      {
        run_id: runId,
        request_id: request.request_id,
        version: request.version,
        decision: RequestDecision.Approve,
        reason: BoardExchange.Direct.answer,
      },
      actor,
    );
  };
  const backend = new FakeBackend(async (spec, prompt) => {
    if (spec.persona_id === BoardExchange.Fixer) {
      observed.fixerPrompts.push(prompt);
      if (observed.fixerPrompts.length === 1 && exchange.direct) await postDirect();
      if (observed.fixerPrompts.length === 1 && exchange.fixerAsks > 0)
        return {
          json: {
            result: null,
            requests: BoardExchange.Asked.slice(0, exchange.fixerAsks).map((pair) =>
              describeAsk(pair.question),
            ),
          },
        };
      return {
        json: { result: { ok: true, marker: BoardExchange.Marker, turn: 1 }, requests: [] },
      };
    }
    observed.skepticPrompts.push(prompt);
    if (observed.skepticPrompts.length === 1 && exchange.skepticAsks > 0)
      return { json: { result: null, requests: [describeAsk(BoardExchange.Own.question)] } };
    return {
      json: {
        result: { verdict: Verdict.Survived, evidence: BoardExchange.Evidence },
        requests: [],
      },
    };
  });
  const { engine: created, run } = await legacyEngineRun(() => backend, {
    project: root,
    config,
    plan: workflow,
    backend: Backend.Fake,
    client_id: BoardExchange.RunClient,
    submission_id: BoardExchange.RunClient,
  });
  engine = created;
  runId = run.run_id;
  observed.run = run;
  await created.start(run.run_id);
  await settle(created, run, exchange, observed);
  return observed;
}

function observe(exchange: Exchange): Promise<Observed> {
  return withTemporaryDirectory((root) => exchangeAtRoot(root, exchange));
}

export async function askAnswer(
  fixerAsks: number,
  direct: boolean,
  mode: AskMode,
): Promise<string> {
  const observed = await observe({
    fixerAsks,
    direct,
    skepticAsks: 0,
    decision: RequestDecision.Approve,
    mode,
  });
  const answers = BoardExchange.Asked.slice(0, fixerAsks).map((pair) => pair.answer);
  const last = observed.fixerPrompts.at(-1) ?? "";
  const held = answers.every((answer) => last.includes(answer));
  const leaked = last.includes(BoardExchange.Direct.answer);
  const rival = last.includes(BoardExchange.Rival);
  const phase = observed.run.nodes[BoardExchange.StepId]?.phases[ExecutionPhase.Worker];
  const same = observed.sessions.every((session) => session === phase?.session_id);
  if (mode === AskMode.Conflicting)
    assert.deepEqual(
      observed.codes,
      Array.from({ length: fixerAsks }, () => ErrorCode.RequestConflict),
    );
  assert.equal(
    observed.run.state,
    mode === AskMode.Unanswered ? RunStatus.Waiting : RunStatus.Passed,
  );
  return `${held} ${leaked} ${rival} ${same} ${observed.fixerPrompts.length}`;
}

export async function boardIsolation(
  fixerAsks: number,
  direct: boolean,
  skepticAsks: number,
  decision: RequestDecision,
): Promise<string> {
  const observed = await observe({
    fixerAsks,
    direct,
    skepticAsks,
    decision,
    mode: AskMode.Answered,
  });
  assert.equal(observed.run.state, RunStatus.Passed);
  const prompt = observed.skepticPrompts.at(-1) ?? "";
  const questions = pairs.slice(0, -1).map((pair) => pair.question);
  const answers = pairs.slice(0, -1).map((pair) => pair.answer);
  assert.ok(prompt.includes(BoardExchange.Marker));
  return `${observed.skepticPrompts.length} ${holdsAny(prompt, questions)} ${holdsAny(prompt, answers)} ${prompt.includes(BoardExchange.Own.answer)}`;
}
