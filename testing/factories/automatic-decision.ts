import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { boardDecisions, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  AutomaticDecision,
  AutomaticDecisionFixture,
  Backend,
  BoardExchange,
  RequestKind,
} from "@titan/constants";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { OperationRequestInput } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { withArtifactRun } from "./artifacts.ts";
import { legacyEngineRun } from "./legacy-run.ts";

function stepRequest(kind: RequestKind, requestId: string): OperationRequestInput {
  return {
    request_id: requestId,
    kind,
    scope: {
      operation: AutomaticDecision.Operation,
      resource: AutomaticDecision.Resource,
      content_hashes: {},
      arguments: [AutomaticDecision.Task],
      environment_names: [],
    },
    origin: { client_id: AutomaticDecision.Client, harness_session_id: null },
    expires_at: Date.now() + AutomaticDecision.ExpiresMs,
  };
}

async function engineRun(root: string, limited: boolean) {
  const config = await resolveConfig({
    home: resolve(root, "home"),
    project: root,
    overrides: limited ? { limits: { max_steps: AutomaticDecision.MaxSteps } } : {},
  });
  const base = vendorRecoveryWorkflow(BoardExchange.CheckTask);
  return legacyEngineRun(() => new FakeBackend(), {
    project: root,
    config,
    plan: validateWorkflow(base),
    backend: Backend.Fake,
    client_id: BoardExchange.RunClient,
    submission_id: BoardExchange.RunClient,
  });
}

function summarize(lines: Awaited<ReturnType<typeof boardDecisions>>): string {
  const line = lines[0];
  return `${lines.length} ${line?.kind} ${line?.by} ${line?.rule} ${line?.level}`;
}

async function viaRoute(): Promise<string> {
  return withArtifactRun(false, async (run, home) => {
    const opened = await createRequestClient(home).open(
      run.run_id,
      stepRequest(RequestKind.AddStep, AutomaticDecision.RequestId),
    );
    assert.equal(opened.level, ApprovalLevel.Auto);
    assert.notEqual(opened.answer, null);
    return summarize(await boardDecisions(new RunStore(run.root).events()));
  });
}

async function viaLedger(mode: AutomaticDecisionFixture): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const limited = mode === AutomaticDecisionFixture.OutsideLimits;
    const { engine, run } = await engineRun(root, limited);
    const kind =
      mode === AutomaticDecisionFixture.WrongKind ? RequestKind.Tool : RequestKind.AddStep;
    await engine.requests.open(run.run_id, stepRequest(kind, AutomaticDecision.RequestId));
    const target =
      mode === AutomaticDecisionFixture.Missing
        ? AutomaticDecision.Other
        : AutomaticDecision.RequestId;
    const decide = () => engine.requests.decideWithinLimits(run.run_id, target);
    const store = () => new RunStore(run.root).events();
    const failing = [
      AutomaticDecisionFixture.OutsideLimits,
      AutomaticDecisionFixture.WrongKind,
      AutomaticDecisionFixture.Missing,
    ].includes(mode);
    if (failing) {
      const failure = await thrownBy(decide);
      assert.equal((await boardDecisions(store())).length, 0);
      throw failure;
    }
    await decide();
    if (mode === AutomaticDecisionFixture.Repeated) {
      const failure = await thrownBy(decide);
      assert.equal((await boardDecisions(store())).length, 1);
      throw failure;
    }
    return summarize(await boardDecisions(store()));
  });
}

export async function automaticDecision(mode: AutomaticDecisionFixture): Promise<string> {
  if (mode === AutomaticDecisionFixture.Route) return viaRoute();
  return viaLedger(mode);
}
