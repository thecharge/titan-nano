import { strict as assert } from "node:assert";
import { mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  PersonaState,
  RequestDecision,
  RequestKind,
  RunStatus,
  Verdict,
} from "@titan/constants";
import {
  checkPersonaUses,
  KnowledgeHub,
  parseKnowledgeEntry,
  personaEntryId,
  resolvePersonaWorkflow,
} from "@titan/knowledge";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { OperationRequestSchema, PersonaRecordSchema, WorkflowSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function personaDeletionHistory(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    let hub = await KnowledgeHub.open(home);
    try {
      const workflow = WorkflowSchema.parse(vendorRecoveryWorkflow("complete"));
      const references = await hub.registerPersonas(workflow);
      const backend = () =>
        new FakeBackend(async (spec) => ({
          json:
            spec.persona_id === "worker"
              ? { ok: true, marker: "candidate", turn: 1 }
              : { verdict: Verdict.Survived, evidence: "Checked retained definition" },
        }));
      const engine = new Engine(
        backend,
        {},
        {
          personaHistory: (run, events, request, usage) =>
            hub.recordPersonaHistory(run, events, request, usage),
          runtimePaths: [home],
        },
      );
      const run = await engine.create({
        project: root,
        plan: validateWorkflow(workflow),
        persona_references: references,
        config: await resolveConfig({ home, project: root }),
        backend: Backend.Fake,
        client_id: "persona-owner",
        submission_id: "archived-persona-run",
      });
      const request = OperationRequestSchema.parse({
        schema_version: 1,
        run_id: run.run_id,
        request_id: "delete-worker",
        version: 2,
        kind: RequestKind.DeletePersona,
        level: ApprovalLevel.Human,
        scope: {
          operation: RequestKind.DeletePersona,
          resource: "worker@1",
          content_hashes: {},
          arguments: [],
          environment_names: [],
        },
        origin: { client_id: "persona-owner", harness_session_id: null },
        created_at: 1,
        expires_at: 100000,
        answer: {
          decision: RequestDecision.Approve,
          reason: "Delete the saved version",
          actor: { client_id: "persona-owner", authority: ApprovalLevel.Human },
          decided_at: 2,
        },
      });
      await hub.personaDecision(request);
      const id = personaEntryId("worker@1");
      const directory = resolve(home, "knowledge", ".history", "persona", id);
      const files = await readdir(directory);
      const last = Math.max(...files.map((file) => Number(file.slice(0, -5))));
      const path = resolve(directory, `${last}.yaml`);
      const before = parseKnowledgeEntry(await readFile(path), 1048576);
      if (mode.startsWith("journal-")) {
        await hub.close();
        const record = PersonaRecordSchema.parse(Bun.YAML.parse(before.body));
        const after = {
          ...before,
          version: before.version + 1,
          body: Bun.YAML.stringify({
            ...record,
            state: mode === "journal-state" ? PersonaState.Trial : PersonaState.Deleted,
          }),
        };
        if (mode === "journal-conflict")
          await writeFile(
            path,
            Bun.YAML.stringify({ ...before, body: Bun.YAML.stringify({ ...record, asked: 1 }) }),
          );
        if (mode === "journal-current")
          await writeFile(
            resolve(home, "knowledge", "persona", `${id}.yaml`),
            Bun.YAML.stringify(before),
          );
        if (mode === "journal-after")
          await writeFile(
            resolve(directory, `${after.version}.yaml`),
            Bun.YAML.stringify(after, null, 2),
          );
        await writeFile(
          resolve(home, "knowledge", ".change.json"),
          JSON.stringify({
            before,
            before_text: (await readFile(path)).toString(),
            after,
            archived: true,
            ...(mode === "journal-conflict"
              ? { before_text: Bun.YAML.stringify(before, null, 2) }
              : {}),
          }),
        );
        if (["journal-state", "journal-conflict", "journal-current"].includes(mode)) {
          await assert.rejects(KnowledgeHub.open(home));
          return true;
        }
        hub = await KnowledgeHub.open(home);
        assert.equal((await hub.history({ id })).current_version, after.version);
        await assert.rejects(hub.get(id));
        return true;
      }
      if (mode === "late" || mode === "restart") {
        if (mode === "restart") {
          await hub.close();
          hub = await KnowledgeHub.open(home);
        }
        await engine.start(run.run_id);
        assert.equal(run.state, RunStatus.Passed);
        const history = await hub.history({ id });
        assert(history.current_version > before.version);
        const saved = parseKnowledgeEntry(
          await readFile(resolve(directory, `${history.current_version}.yaml`)),
          1048576,
        );
        const record = PersonaRecordSchema.parse(Bun.YAML.parse(saved.body));
        assert.equal(record.state, PersonaState.Deleted);
        assert.equal(record.survived, 1);
        assert.equal(record.usage?.executions, 1);
        await hub.recordPersonaHistory(run, new RunStore(run.root).events());
        assert.equal((await hub.history({ id })).current_version, saved.version);
        await hub.personaDecision(request);
        const used = WorkflowSchema.parse({
          ...workflow,
          personas: { ...workflow.personas, worker: { use: "worker@1" } },
        });
        await assert.rejects(checkPersonaUses(home, used));
        await assert.rejects(resolvePersonaWorkflow(home, used));
        return true;
      }
      if (mode === "filename") await writeFile(resolve(directory, "wrong.yaml"), "wrong");
      if (mode === "empty") {
        await rm(directory, { recursive: true });
        await mkdir(directory);
      }
      if (mode === "state" || mode === "version") {
        const record = PersonaRecordSchema.parse(Bun.YAML.parse(before.body));
        await writeFile(
          path,
          Bun.YAML.stringify({
            ...before,
            version: mode === "version" ? last + 1 : last,
            body: Bun.YAML.stringify({
              ...record,
              state: mode === "state" ? PersonaState.Trial : record.state,
            }),
          }),
        );
      }
      if (mode === "linked") {
        await rm(directory, { recursive: true });
        await symlink(root, directory);
      }
      await assert.rejects(hub.history({ id }));
      return true;
    } finally {
      await hub.close();
    }
  });
}
