import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  ApprovalLevel,
  Backend,
  ErrorCode,
  Packaging,
  PersonaState,
  RequestDecision,
  RequestKind,
  RunAction,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { KnowledgeHub, personaEntryId } from "@titan/knowledge";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type OperationRequest,
  OperationRequestSchema,
  PersonaRecordSchema,
  RequestPersonaSchema,
  StepSchema,
  WorkflowSchema,
} from "@titan/types";
import { runCliCommand } from "../support/command.ts";
import { openServer } from "./server-run-hub.ts";

export async function personaDefinition(mode: string, cli = Packaging.CliSource): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const backend = () =>
      new FakeBackend(async (spec) => ({
        json:
          spec.persona_id === "checker"
            ? { verdict: Verdict.Survived, evidence: "Reviewed candidate" }
            : { ok: true, marker: "candidate", turn: 1 },
      }));
    let server = await openServer(home, backend, cli === Packaging.CliSource ? undefined : cli);
    const client = createRunClient(home);
    const requests = createRequestClient(home);
    const creation = mode === "new" || mode === "cli" || mode === "tags" || mode === "order";
    const invalid = mode === "tags" || mode === "name" || mode === "duplicate";
    const merge = mode === "merge" || mode === "duplicate";
    try {
      const original = WorkflowSchema.parse(vendorRecoveryWorkflow("complete"));
      assert(original.steps?.[0]);
      const worker = original.personas.worker;
      assert(worker && "role" in worker);
      const tags = mode === "order" ? ["systems", "code"] : ["systems"];
      const supplied = RequestPersonaSchema.parse({
        name: creation ? "specialist" : mode === "name" ? "other" : "worker",
        definition: {
          ...worker,
          role: "Review the implementation carefully",
          tags:
            mode === "tags" ? ["other"] : mode === "order" ? ["code", "systems", "review"] : tags,
        },
      });
      const step = StepSchema.parse(original.steps[0]);
      assert("persona" in step.do);
      const workflow = {
        ...original,
        backends: {
          fake: {
            script: {
              version: 1,
              answers: [
                {
                  persona: "worker",
                  task: step.do.task,
                  answer: { ok: true, marker: "candidate", turn: 1 },
                },
                {
                  persona: "specialist@1",
                  task: step.do.task,
                  answer: { ok: true, marker: "candidate", turn: 1 },
                },
                {
                  persona: "checker",
                  task: "complete",
                  answer: { verdict: Verdict.Survived, evidence: "Reviewed candidate" },
                },
              ],
            },
          },
        },
        steps: [{ ...step, do: creation ? { call: { tags, task: "complete" } } : step.do }],
      };
      const run = await client.submit({
        project,
        workflow,
        backend: Backend.Fake,
        client_id: "persona-owner",
        submission_id: "persona-definition",
      });
      assert(
        await waitUntil(
          async () =>
            (await client.get(run.run_id)).state ===
            (creation ? RunStatus.Waiting : RunStatus.Passed),
        ),
      );
      const opened = creation
        ? (await requests.list({ run_id: run.run_id })).requests[0]?.request
        : await requests.open(run.run_id, {
            request_id: "improve-definition",
            kind: merge ? RequestKind.MergePersonas : RequestKind.ImprovePersona,
            scope: {
              operation: merge ? RequestKind.MergePersonas : RequestKind.ImprovePersona,
              resource: merge
                ? mode === "duplicate"
                  ? "worker@1,worker@1"
                  : "worker@1,checker@1"
                : "worker@1",
              content_hashes: {},
              arguments: [],
              environment_names: [],
            },
            origin: { client_id: "persona-owner", harness_session_id: null },
            expires_at: Date.now() + 60000,
          });
      assert(opened);
      const input = {
        run_id: run.run_id,
        request_id: opened.request_id,
        version: opened.version,
        decision: RequestDecision.Approve,
        reason: "Reviewed definition",
        client_id: "persona-owner",
        persona: supplied,
      };
      if (invalid) {
        await assert.rejects(requests.answer(input, ApprovalLevel.Main), {
          code: ErrorCode.PermissionDenied,
        });
        assert.equal((await requests.get(run.run_id, opened.request_id)).answer, null);
      } else {
        let answered: OperationRequest;
        if (mode === "cli") {
          const file = resolve(root, "persona.yaml");
          await writeFile(file, Buffer.from(Bun.YAML.stringify(supplied)));
          answered = OperationRequestSchema.parse(
            await runCliCommand(cli, home, [
              "answer",
              run.run_id,
              opened.request_id,
              "--persona",
              file,
              "--request-version",
              String(opened.version),
              "--client-id",
              "persona-owner",
            ]),
          );
        } else answered = await requests.answer(input, ApprovalLevel.Main);
        assert.deepEqual(answered.answer?.persona, supplied);
        if (creation) {
          await client.control(run.run_id, RunAction.Resume);
          assert(
            await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed),
          );
        }
      }
      await server.stop();
      let hub = await KnowledgeHub.open(home);
      const target = creation ? "specialist@1" : "worker@2";
      if (invalid) {
        await assert.rejects(hub.get(personaEntryId(target)), { code: ErrorCode.KnowledgeMissing });
        await hub.close();
        return true;
      }
      const saved = (await hub.get(personaEntryId(target))).entry;
      const record = PersonaRecordSchema.parse(Bun.YAML.parse(saved.body));
      assert.equal(record.state, PersonaState.Trial);
      assert.equal(record.decisions?.length, 1);
      assert.deepEqual(record.persona, supplied.definition);
      if (!creation) {
        assert.equal(record.parent, "worker@1");
        const previous = PersonaRecordSchema.parse(
          Bun.YAML.parse((await hub.get(personaEntryId("worker@1"))).entry.body),
        );
        assert.equal(previous.state, PersonaState.Proposed);
        assert.equal(previous.persona.role, worker.role);
        if (merge) {
          const checker = PersonaRecordSchema.parse(
            Bun.YAML.parse((await hub.get(personaEntryId("checker@1"))).entry.body),
          );
          assert.equal(checker.state, PersonaState.Proposed);
        }
      }
      await hub.close();
      server = await openServer(home, backend, cli === Packaging.CliSource ? undefined : cli);
      assert.deepEqual(
        (await requests.get(run.run_id, opened.request_id)).answer?.persona,
        supplied,
      );
      await server.stop();
      hub = await KnowledgeHub.open(home);
      try {
        assert.deepEqual((await hub.get(saved.id)).entry, saved);
      } finally {
        await hub.close();
      }
      return true;
    } finally {
      await server.stop();
    }
  });
}
