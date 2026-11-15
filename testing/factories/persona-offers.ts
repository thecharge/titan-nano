import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  PersonaState,
  RequestKind,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { KnowledgeHub, personaEntryId } from "@titan/knowledge";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { PersonaRecordSchema, WorkflowSchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function personaOffers(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const hub = await KnowledgeHub.open(home);
    try {
      const workflow = WorkflowSchema.parse(vendorRecoveryWorkflow("complete"));
      await hub.registerPersonas(workflow);
      let next = WorkflowSchema.parse({
        ...workflow,
        personas: {
          ...workflow.personas,
          worker: { mutates: "worker@1", role: "Review the implementation carefully" },
        },
        steps: workflow.steps?.map((step) => ({ ...step, max_attempts: 1 })),
      });
      let references = await hub.registerPersonas(next);
      const many = mode === "retire-many";
      if (many) {
        next = WorkflowSchema.parse({
          ...next,
          personas: {
            ...next.personas,
            worker: { mutates: "worker@2", role: "Review all replacement candidates carefully" },
          },
        });
        references = await hub.registerPersonas(next);
      }
      const current = many ? "worker@3" : "worker@2";
      const weak = mode === "review" || mode === "single";
      const oldCounts = mode === "worse" ? [9, 1] : [6, 4];
      const nextCounts = weak ? [1, 6] : mode === "worse" ? [20, 4] : [9, 0];
      for (const reference of many
        ? ["worker@1", "worker@2", "worker@3"]
        : ["worker@1", "worker@2"]) {
        const first = reference !== current;
        const [survived, refuted] = first ? oldCounts : nextCounts;
        const { entry } = await hub.get(personaEntryId(reference));
        const record = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
        await hub.update({
          id: entry.id,
          version: entry.version,
          entry: {
            kind: entry.kind,
            title: entry.title,
            tags: entry.tags,
            body: Bun.YAML.stringify({
              ...record,
              state: first && mode === "review" ? PersonaState.NeedsUpdate : PersonaState.Trial,
              survived,
              refuted,
            }),
          },
        });
      }
      let calls = 0;
      const backend = () =>
        new FakeBackend(async (spec) => {
          calls++;
          return {
            json:
              spec.persona_id === "worker"
                ? { ok: true, marker: "candidate", turn: 1 }
                : {
                    verdict: weak ? Verdict.Refuted : Verdict.Survived,
                    evidence: "Reviewed candidate",
                  },
          };
        });
      const engine = new Engine(
        backend,
        {},
        {
          personaHistory: (run, events, request) => hub.recordPersonaHistory(run, events, request),
          runtimePaths: [home],
        },
      );
      const run = await engine.create({
        project: root,
        plan: validateWorkflow(await hub.resolvePersonas(next)),
        persona_references: references,
        config: await resolveConfig({ home, project: root }),
        backend: Backend.Fake,
        client_id: "persona-owner",
        submission_id: "persona-offers",
      });
      await engine.start(run.run_id);
      assert.equal(run.state, weak ? RunStatus.Failed : RunStatus.Passed);
      assert.equal(calls, 2);
      const requests = await engine.requests.list(run.run_id);
      const offers = requests.filter(
        (request) =>
          request.kind === RequestKind.RetirePersona ||
          request.scope.resource === "worker@1,worker@2",
      );
      assert.equal(offers.length, many ? 2 : mode === "retire" || mode === "review" ? 1 : 0);
      if (many)
        assert.deepEqual(
          offers.map((offer) => offer.scope.resource),
          ["worker@1", "worker@2"],
        );
      if (offers[0]) {
        assert.equal(offers[0].kind, weak ? RequestKind.ImprovePersona : RequestKind.RetirePersona);
        assert.equal(offers[0].answer, null);
      }
      const previous = (await hub.get(personaEntryId("worker@1"))).entry;
      const replacement = (await hub.get(personaEntryId(current))).entry;
      const restored = new Engine(
        backend,
        {},
        {
          personaHistory: (run, events, request) => hub.recordPersonaHistory(run, events, request),
        },
      );
      await restored.load(run.root);
      await assert.rejects(async () => restored.resume(run.run_id), {
        code: ErrorCode.TerminalRun,
      });
      await hub.recordPersonaHistory(
        run,
        new RunStore(run.root).events(),
        async (_run, pending) => {
          assert(
            requests.some(
              (request) =>
                request.kind === pending.kind && request.scope.resource === pending.names.join(","),
            ),
          );
        },
      );
      assert.deepEqual(await restored.requests.list(run.run_id), requests);
      assert.deepEqual((await hub.get(previous.id)).entry, previous);
      assert.deepEqual((await hub.get(replacement.id)).entry, replacement);
      assert.equal(calls, 2);
      return true;
    } finally {
      await hub.close();
    }
  });
}
