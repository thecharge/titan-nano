import { strict as assert } from "node:assert";
import { inspectArtifacts } from "@titan/artifacts";
import { RunStore } from "@titan/board";
import {
  ApprovalLevel,
  ArtifactMutation,
  ArtifactRequestFixture,
  RequestDecision,
  RequestKind,
  RunEventKind,
} from "@titan/constants";
import { RequestLedger } from "@titan/requests";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { type Run, RunSchema } from "@titan/types";
import { mutateArtifacts, withArtifactRun } from "./artifacts.ts";

async function artifactEscalation(run: Run, mode: ArtifactRequestFixture) {
  const store = new RunStore(run.root);
  await store.read();
  const current = await store.snapshot();
  const ledger = new RequestLedger({
    snapshot: async () => store.snapshot(),
    events: (_, through) => store.events(through),
    append: async (_, kind, request) => {
      await store.commit(current, kind, request);
    },
  });
  const opened = await ledger.open(run.run_id, {
    request_id: "escalation",
    kind: RequestKind.Tool,
    scope: {
      operation: "inspect",
      resource: "candidate",
      content_hashes: {},
      arguments: [],
      environment_names: [],
    },
    origin: { client_id: "codex", harness_session_id: "session" },
    expires_at: Date.now() + 60000,
  });
  const input = {
    run_id: run.run_id,
    request_id: opened.request_id,
    version: opened.version,
    reason: "Passed up for review",
  };
  const escalated = await ledger.escalate(input, {
    client_id: "main",
    authority: ApprovalLevel.Main,
  });
  await ledger.answer(
    { ...input, version: escalated.version, decision: RequestDecision.Approve },
    { client_id: "person", authority: ApprovalLevel.Human },
  );
  if (mode === ArtifactRequestFixture.EscalatedState) {
    current.workflow_id = "changed";
    await store.commit(current, RunEventKind.RequestEscalated, escalated);
  }
  if (mode === ArtifactRequestFixture.EscalatedContent)
    await mutateArtifacts(current, ArtifactMutation.Content);
  return inspectArtifacts(await store.snapshot());
}

export async function artifactAfterRequest(mode: ArtifactRequestFixture) {
  const executable =
    mode === ArtifactRequestFixture.Executable ||
    mode === ArtifactRequestFixture.EscalatedExecutable;
  return withArtifactRun(executable, async (run, home) => {
    const before = await inspectArtifacts(run);
    if (
      [
        ArtifactRequestFixture.Escalated,
        ArtifactRequestFixture.EscalatedExecutable,
        ArtifactRequestFixture.EscalatedState,
        ArtifactRequestFixture.EscalatedContent,
      ].includes(mode)
    ) {
      assert.deepEqual(await artifactEscalation(run, mode), before);
      return true;
    }
    if (mode === ArtifactRequestFixture.CurrentIdentity) {
      run.workflow_id = "changed";
      await inspectArtifacts(run);
      return true;
    }
    const client = createRequestClient(home);
    const request = await client.open(run.run_id, {
      request_id: "review",
      kind: RequestKind.Tool,
      scope: {
        operation: "inspect",
        resource: "candidate",
        content_hashes: {},
        arguments: [],
        environment_names: [],
      },
      origin: { client_id: "reviewer", harness_session_id: "session" },
      expires_at: Date.now() + 60000,
    });
    await client.answer(
      {
        run_id: run.run_id,
        request_id: request.request_id,
        version: request.version,
        decision: RequestDecision.Approve,
        reason: "Reviewed",
        client_id: "reviewer",
      },
      ApprovalLevel.Main,
    );
    const current = RunSchema.parse(await createRunClient(home).get(run.run_id));
    assert.equal(current.version, run.version + 2);
    if (mode === ArtifactRequestFixture.Content)
      await mutateArtifacts(current, ArtifactMutation.Content);
    if (mode === ArtifactRequestFixture.Mode) await mutateArtifacts(current, ArtifactMutation.Mode);
    if (mode === ArtifactRequestFixture.Unsupported) Reflect.set(current, "error", undefined);
    if (
      [
        ArtifactRequestFixture.State,
        ArtifactRequestFixture.Intermediate,
        ArtifactRequestFixture.Unrelated,
        ArtifactRequestFixture.Duplicate,
      ].includes(mode)
    ) {
      const store = new RunStore(current.root);
      await store.read();
      const identity = current.workflow_id;
      if (mode === ArtifactRequestFixture.State || mode === ArtifactRequestFixture.Intermediate)
        current.workflow_id = "changed";
      await store.commit(
        current,
        mode === ArtifactRequestFixture.Unrelated
          ? RunEventKind.Paused
          : mode === ArtifactRequestFixture.Duplicate
            ? RunEventKind.Passed
            : RunEventKind.RequestOpened,
        { artifact_hash: before.hash },
      );
      if (mode === ArtifactRequestFixture.Intermediate) {
        current.workflow_id = identity;
        await store.commit(current, RunEventKind.RequestAnswered, { artifact_hash: before.hash });
      }
    }
    if (mode === ArtifactRequestFixture.MissingTail) current.version++;
    assert.deepEqual(await inspectArtifacts(current), before);
    return true;
  });
}
