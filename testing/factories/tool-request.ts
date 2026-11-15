import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  BoardExchange,
  ExitCode,
  RequestDecision,
  RequestKind,
  RunStatus,
  StepStatus,
  ToolGrant,
  ToolMode,
  Verdict,
} from "@titan/constants";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { OperationRequest, Run } from "@titan/types";
import { resolvedPersona, validateWorkflow } from "@titan/workflow";
import { projectionMatches } from "../support/request-projection.ts";
import { legacyEngineRun } from "./legacy-run.ts";

const actor = { client_id: ToolGrant.Reviewer, authority: ApprovalLevel.Main };

function describeRequest(kind: RequestKind, resource: string) {
  return {
    kind,
    scope: {
      operation: kind,
      resource,
      content_hashes: {},
      arguments: [],
      environment_names: [],
    },
    expires_at: Date.now() + ToolGrant.ExpiresMs,
  };
}

function toolWorkflow(sideSteps: number) {
  const base = vendorRecoveryWorkflow(ToolGrant.CheckTask);
  const step = base.steps[0];
  assert.ok(step);
  const sides = ToolGrant.Side.slice(0, sideSteps).map((id, index) => ({
    ...step,
    id,
    needs: index === 0 ? [] : [ToolGrant.Side[index - 1] ?? ""],
    do: { persona: ToolGrant.Worker, task: ToolGrant.FixTask },
  }));
  return validateWorkflow({
    name: base.name,
    goal: base.goal,
    personas: {
      ...base.personas,
      [ToolGrant.Fixer]: { ...base.personas.worker, request_turns: true },
    },
    graph: {
      nodes: [
        {
          ...step,
          needs: [],
          do: { persona: ToolGrant.Fixer, task: ToolGrant.FixTask },
          falsify: [{ persona: ToolGrant.Checker, task: ToolGrant.CheckTask }],
        },
        ...sides,
      ],
    },
  });
}

async function toolRun(root: string, sideSteps: number, asks: boolean) {
  const config = await resolveConfig({
    home: resolve(root, "home"),
    project: root,
    overrides: { recovery: { max_retries: 0 }, limits: { max_parallel: 2 } },
  });
  const prompts: string[] = [];
  const tools: string[][] = [];
  const backend = new FakeBackend(async (spec, prompt) => {
    if (spec.persona_id === ToolGrant.Fixer) {
      prompts.push(prompt);
      tools.push([...spec.tools]);
      if (prompts.length === 1 && asks)
        return {
          json: {
            result: null,
            requests: [describeRequest(RequestKind.Tool, ToolGrant.Tool)],
          },
        };
      return {
        json: { result: { ok: true, marker: ToolGrant.Marker, turn: 1 }, requests: [] },
      };
    }
    if (spec.persona_id === ToolGrant.Checker)
      return { json: { verdict: Verdict.Survived, evidence: ToolGrant.Evidence } };
    return { json: { ok: true, marker: ToolGrant.Marker, turn: 1 } };
  });
  const { engine, run } = await legacyEngineRun(() => backend, {
    project: root,
    config,
    plan: toolWorkflow(sideSteps),
    backend: Backend.Fake,
    client_id: ToolGrant.RunClient,
    submission_id: ToolGrant.RunClient,
  });
  await engine.start(run.run_id);
  return { engine, run, prompts, tools };
}

async function openRequests(engine: Engine, run: Run): Promise<OperationRequest[]> {
  return (await engine.requests.list(run.run_id)).filter((request) => request.answer === null);
}

function passedSides(run: Run, sideSteps: number): number {
  return ToolGrant.Side.slice(0, sideSteps).filter(
    (id) => run.nodes[id]?.state === StepStatus.Passed,
  ).length;
}

function exitFor(run: Run): ExitCode {
  return run.state === RunStatus.Waiting ? ExitCode.Blocked : ExitCode.Success;
}

async function askedAtRoot(root: string, sideSteps: number, asks: boolean): Promise<string> {
  const { engine, run } = await toolRun(root, sideSteps, asks);
  const open = await openRequests(engine, run);
  if (open.length) await projectionMatches(run, open);
  const first = open[0];
  return `${run.state} ${exitFor(run)} ${open.length} ${first?.kind} ${first?.scope.resource} ${first?.origin.execution?.step_id} ${passedSides(run, sideSteps)}`;
}

export function toolAsk(sideSteps: number, asks: boolean): Promise<string> {
  return withTemporaryDirectory((root) => askedAtRoot(root, sideSteps, asks));
}

async function answeredAtRoot(root: string, mode: ToolMode): Promise<string> {
  const { engine, run, prompts, tools } = await toolRun(root, 0, true);
  const [request] = await openRequests(engine, run);
  assert.ok(request);
  if (mode !== ToolMode.Open)
    await engine.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: mode === ToolMode.Granted ? RequestDecision.Approve : RequestDecision.Deny,
        reason: mode === ToolMode.Granted ? ToolGrant.Granted : ToolGrant.Reason,
      },
      actor,
    );
  await engine.resume(run.run_id);
  const last = prompts.at(-1) ?? "";
  const listed = (await openRequests(engine, run)).map((open) => open.request_id);
  const answered = (await engine.requests.list(run.run_id)).find(
    (entry) => entry.request_id === request.request_id,
  );
  return `${run.state} ${exitFor(run)} ${tools.at(-1)?.includes(ToolGrant.Tool)} ${last.includes(ToolGrant.Reason)} ${prompts.length} ${listed.includes(request.request_id)} ${answered?.answer?.decision}`;
}

export function toolAnswer(mode: ToolMode): Promise<string> {
  return withTemporaryDirectory((root) => answeredAtRoot(root, mode));
}

export function toolWriteGrant(
  tool: AgentTool,
  worker: boolean,
  approved: boolean,
  reload: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const base = vendorRecoveryWorkflow();
    const workflow = validateWorkflow({
      ...base,
      steps: base.steps.map((step) => ({ ...step, files: ["result.txt"] })),
    }).workflow;
    const persona = resolvedPersona(workflow, worker ? ToolGrant.Worker : ToolGrant.Checker);
    persona.tools = [AgentTool.Read];
    persona.request_turns = true;
    let calls = 0;
    const backend = new FakeBackend(async (spec) => {
      const selected = spec.persona_id === (worker ? ToolGrant.Worker : ToolGrant.Checker);
      const result =
        spec.persona_id === ToolGrant.Worker
          ? { ok: true, marker: ToolGrant.Marker, turn: 1 }
          : { verdict: Verdict.Survived, evidence: ToolGrant.Evidence };
      if (!selected) return { json: result };
      calls++;
      if (calls === 1) {
        assert.equal(spec.writable, false);
        return { json: { result: null, requests: [describeRequest(RequestKind.Tool, tool)] } };
      }
      assert.equal(spec.writable, worker && approved);
      assert.equal(spec.tools.includes(tool), approved);
      assert.deepEqual(spec.file_scope?.paths, ["result.txt"]);
      return { json: { result, requests: [] } };
    });
    const engine = new Engine(() => backend);
    const run = await engine.create({
      project,
      config: await resolveConfig({ home: resolve(project, "home"), project }),
      plan: validateWorkflow(workflow),
      backend: Backend.Fake,
      client_id: ToolGrant.RunClient,
      submission_id: ToolGrant.RunClient,
    });
    await engine.start(run.run_id);
    assert.equal(run.state, RunStatus.Waiting);
    const resumed = reload ? new Engine(() => backend) : engine;
    const restored = reload ? await resumed.load(run.root) : run;
    const request = (await resumed.requests.list(run.run_id))[0];
    assert.ok(request);
    await resumed.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: approved ? RequestDecision.Approve : RequestDecision.Deny,
        reason: ToolGrant.Granted,
      },
      actor,
    );
    await resumed.resume(run.run_id);
    assert.equal(restored.state, RunStatus.Passed, JSON.stringify(restored.nodes));
    assert.equal(restored.nodes.deliver?.attempt, 1);
    assert.equal(calls, 2);
    return true;
  });
}

async function acceptedAtRoot(
  root: string,
  kind: RequestKind,
  authority: ApprovalLevel,
): Promise<string> {
  const config = await resolveConfig({ home: resolve(root, "home"), project: root });
  const backend = new FakeBackend();
  const { engine, run } = await legacyEngineRun(() => backend, {
    project: root,
    config,
    plan: validateWorkflow(vendorRecoveryWorkflow(ToolGrant.CheckTask)),
    backend: Backend.Fake,
    client_id: ToolGrant.RunClient,
    submission_id: ToolGrant.RunClient,
  });
  const request = await engine.requests.open(run.run_id, {
    request_id: ToolGrant.Merge,
    ...describeRequest(kind, ToolGrant.Merged),
    origin: { client_id: BoardExchange.Planner, harness_session_id: null },
  });
  const refused = await thrownBy(() =>
    engine.requests.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: RequestDecision.Approve,
        reason: ToolGrant.Merged,
      },
      { client_id: ToolGrant.Reviewer, authority },
    ),
  );
  if (refused) return String(Reflect.get(Object(refused), "code"));
  const stored = (await engine.requests.list(run.run_id)).find(
    (entry) => entry.request_id === request.request_id,
  );
  return `${stored?.answer?.decision} ${stored?.answer?.actor.authority} ${stored?.level} ${JSON.stringify(stored?.scope) === JSON.stringify(request.scope)}`;
}

export function acceptAsSent(kind: RequestKind, authority: ApprovalLevel): Promise<string> {
  return withTemporaryDirectory((root) => acceptedAtRoot(root, kind, authority));
}
