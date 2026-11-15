import { strict as assert } from "node:assert";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  ApprovalLevel,
  Backend,
  KnowledgePublicationStage,
  Packaging,
  PersonaDecisionStage,
  PersonaState,
  RequestDecision,
  RequestKind,
  RunStatus,
  Verdict,
} from "@titan/constants";
import {
  KnowledgeHub,
  ownedKnowledge,
  parseKnowledgeEntry,
  personaEntryId,
} from "@titan/knowledge";
import { Engine } from "@titan/runner";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type KnowledgeEntry,
  PersonaRecordSchema,
  type Run,
  RunSchema,
  WorkflowSchema,
} from "@titan/types";
import { openServer } from "./server-run-hub.ts";

async function deletedRecord(home: string, hub: KnowledgeHub): Promise<KnowledgeEntry> {
  const id = personaEntryId("worker@1");
  await assert.rejects(hub.get(id));
  const directory = resolve(home, "knowledge", ".history", "persona", id);
  const files = await readdir(directory);
  const latest = Math.max(...files.map((name) => Number(name.slice(0, -5))));
  const entry = parseKnowledgeEntry(await readFile(resolve(directory, `${latest}.yaml`)), 1048576);
  const record = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
  assert.equal(record.state, PersonaState.Deleted);
  assert.equal(record.decisions?.length, 1);
  assert(files.length >= 2);
  const history = await hub.history({ id });
  assert.equal(history.current_version, entry.version);
  assert.equal(history.entries[0]?.version, entry.version - 1);
  return entry;
}

export async function personaDecisionProcess(
  kind: RequestKind,
  approved: boolean,
  cli = Packaging.CliSource,
) {
  return withTemporaryDirectory(async (home) => {
    const backend = () =>
      new FakeBackend(async (spec) => ({
        json:
          spec.persona_id === "worker"
            ? { ok: true, marker: "candidate", turn: 1 }
            : { verdict: Verdict.Survived, evidence: "Checked candidate" },
      }));
    let server = await openServer(home, backend, cli === Packaging.CliSource ? undefined : cli);
    const client = createRunClient(home);
    const requests = createRequestClient(home);
    try {
      const workflow = vendorRecoveryWorkflow("complete");
      const run = await client.submit({
        project: home,
        workflow: {
          ...workflow,
          backends: {
            fake: {
              script: {
                version: 1,
                answers: [
                  {
                    persona: "worker",
                    task: workflow.steps[0]?.do.task,
                    answer: { ok: true, marker: "candidate", turn: 1 },
                  },
                  {
                    persona: "checker",
                    task: workflow.steps[0]?.falsify[0]?.task,
                    answer: { verdict: Verdict.Survived, evidence: "Checked candidate" },
                  },
                ],
              },
            },
          },
        },
        backend: Backend.Fake,
        client_id: "persona-owner",
        submission_id: "persona-decision",
      });
      assert(
        await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed),
      );
      const opened = await requests.open(run.run_id, {
        request_id: "persona-state-change",
        kind,
        scope: {
          operation: kind,
          resource: "worker@1",
          content_hashes: {},
          arguments: [],
          environment_names: [],
        },
        origin: { client_id: "persona-owner", harness_session_id: null },
        expires_at: Date.now() + 60000,
      });
      await requests.answer(
        {
          run_id: run.run_id,
          request_id: opened.request_id,
          version: opened.version,
          decision: approved ? RequestDecision.Approve : RequestDecision.Deny,
          reason: "Reviewed persona state change",
          client_id: "persona-owner",
        },
        kind === RequestKind.DeletePersona ? ApprovalLevel.Human : ApprovalLevel.Main,
      );
      await server.stop();
      let hub = await KnowledgeHub.open(home);
      const deleted = approved && kind === RequestKind.DeletePersona;
      const before = deleted
        ? await deletedRecord(home, hub)
        : (await hub.get(personaEntryId("worker@1"))).entry;
      const record = PersonaRecordSchema.parse(Bun.YAML.parse(before.body));
      assert.equal(
        record.state,
        approved
          ? kind === RequestKind.NewPersona
            ? PersonaState.Trial
            : deleted
              ? PersonaState.Deleted
              : PersonaState.Retired
          : PersonaState.Proposed,
      );
      assert.equal(record.decisions?.length ?? 0, approved ? 1 : 0);
      await hub.close();
      server = await openServer(home, backend, cli === Packaging.CliSource ? undefined : cli);
      await requests.get(run.run_id, opened.request_id);
      await server.stop();
      hub = await KnowledgeHub.open(home);
      try {
        assert.deepEqual(
          deleted ? await deletedRecord(home, hub) : (await hub.get(before.id)).entry,
          before,
        );
        if (deleted) {
          await assert.rejects(
            hub.resolvePersonas(
              WorkflowSchema.parse({
                ...workflow,
                personas: { ...workflow.personas, worker: { use: "worker@1" } },
              }),
            ),
          );
          const references = await hub.registerPersonas(WorkflowSchema.parse(workflow));
          assert.equal(references.worker, "worker@2");
        }
      } finally {
        await hub.close();
      }
      return true;
    } finally {
      await server.stop();
    }
  });
}

export async function personaDecisionRecovery(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const backend = () =>
      new FakeBackend(async (spec) => ({
        json:
          spec.persona_id === "worker"
            ? { ok: true, marker: "candidate", turn: 1 }
            : { verdict: Verdict.Survived, evidence: "Checked candidate" },
      }));
    const server = await openServer(home, backend);
    let run: Run;
    try {
      const client = createRunClient(home);
      run = RunSchema.parse(
        await client.submit({
          project: root,
          workflow: vendorRecoveryWorkflow("complete"),
          backend: Backend.Fake,
          client_id: "persona-owner",
          submission_id: "persona-recovery",
        }),
      );
      assert(
        await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed),
      );
      run = RunSchema.parse(await client.get(run.run_id));
    } finally {
      await server.stop();
    }
    const deleting = mode.startsWith("delete-");
    const point = deleting ? mode.slice(7) : mode;
    let interrupted = false;
    let publications = 0;
    let hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (stage === KnowledgePublicationStage.Journal) publications++;
      if (
        !interrupted &&
        ((point === "journal" && stage === KnowledgePublicationStage.Journal) ||
          (point === "index" && stage === KnowledgePublicationStage.Index) ||
          (point === "archive" && publications === 2 && stage === KnowledgePublicationStage.File))
      ) {
        interrupted = true;
        throw new Error("interrupted persona decision publication");
      }
    });
    let decide = ownedKnowledge(home, {}, 8, hub).personaDecision;
    let engine = new Engine(
      backend,
      {},
      {
        personaDecision: async (request, stage) => {
          if (!interrupted && point === "before" && stage === PersonaDecisionStage.Publish) {
            interrupted = true;
            throw new Error("interrupted before persona decision publication");
          }
          await decide(request, stage);
        },
      },
    );
    await engine.load(run.root);
    const opened = await engine.requests.open(run.run_id, {
      request_id: "persona-recovery-change",
      kind: deleting ? RequestKind.DeletePersona : RequestKind.NewPersona,
      scope: {
        operation:
          mode === "scope"
            ? RequestKind.RetirePersona
            : deleting
              ? RequestKind.DeletePersona
              : RequestKind.NewPersona,
        resource: mode === "target" ? "worker" : "worker@1",
        content_hashes: {},
        arguments: [],
        environment_names: [],
      },
      origin: { client_id: "persona-owner", harness_session_id: null },
      expires_at: Date.now() + 60000,
    });
    await assert.rejects(
      engine.requests.answer(
        {
          run_id: run.run_id,
          request_id: opened.request_id,
          version: opened.version,
          decision: RequestDecision.Approve,
          reason: "Reviewed persona",
        },
        {
          client_id: "persona-owner",
          authority: deleting && point !== "main" ? ApprovalLevel.Human : ApprovalLevel.Main,
        },
      ),
    );
    assert.equal(
      (await engine.requests.list(run.run_id))[0]?.answer?.decision,
      interrupted ? RequestDecision.Approve : undefined,
    );
    if (point === "before") await engine.replayRequestEffects(run.run_id);
    await hub.close();
    hub = await KnowledgeHub.open(home);
    decide = ownedKnowledge(home, {}, 8, hub).personaDecision;
    try {
      engine = new Engine(
        backend,
        {},
        { personaDecision: (request, stage) => decide(request, stage) },
      );
      await engine.load(run.root);
      await engine.replayRequestEffects(run.run_id);
      const entry =
        deleting && interrupted
          ? await deletedRecord(home, hub)
          : (await hub.get(personaEntryId("worker@1"))).entry;
      const record = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
      assert.equal(
        record.state,
        interrupted
          ? deleting
            ? PersonaState.Deleted
            : PersonaState.Trial
          : PersonaState.Proposed,
      );
      assert.equal(record.decisions?.length ?? 0, interrupted ? 1 : 0);
      return true;
    } finally {
      await hub.close();
    }
  });
}
