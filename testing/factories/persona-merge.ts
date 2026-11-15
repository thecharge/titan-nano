import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { Backend, PersonaState, RequestKind, RunStatus, Verdict } from "@titan/constants";
import { KnowledgeHub, personaEntryId } from "@titan/knowledge";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { PersonaRecordSchema, WorkflowSchema } from "@titan/types";

export async function personaMergeProcess(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const workflow = WorkflowSchema.parse(vendorRecoveryWorkflow("complete"));
    const definitions = WorkflowSchema.parse({
      ...workflow,
      personas: {
        ...workflow.personas,
        skeptic: { description: "First reviewer", role: "Review candidate logic", tools: [] },
        doubter: {
          description: "Second reviewer",
          role: mode === "same" ? "Review candidate logic" : "Challenge claim inference",
          tools: [],
        },
        ...(mode === "capacity"
          ? Object.fromEntries(
              Array.from({ length: 24 }, (_, index) => [
                `reviewer${index}`,
                { description: "Eligible reviewer", role: "Review candidate logic", tools: [] },
              ]),
            )
          : {}),
      },
    });
    const hub = await KnowledgeHub.open(home);
    try {
      await hub.registerPersonas(definitions);
      for (const name of Object.keys(definitions.personas).filter(
        (name) => name !== "worker" && name !== "checker",
      )) {
        const { entry } = await hub.get(personaEntryId(`${name}@1`));
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
              state:
                mode === "retired" && name === "skeptic"
                  ? PersonaState.Retired
                  : PersonaState.Trial,
            }),
          },
        });
      }
    } finally {
      await hub.close();
    }
    const score = mode === "boundary" ? 0.9 : mode === "under" ? 0.89 : 0.93;
    const backend = () =>
      new FakeBackend(async (spec) => ({
        json:
          spec.persona_id === "worker"
            ? { ok: true, marker: "candidate", turn: 1 }
            : { verdict: Verdict.Survived, evidence: "Reviewed actual candidate" },
      }));
    const options = {
      embedders: [
        {
          name: "@titan/embedder-merge-fixture",
          ready: async () => mode !== "unavailable",
          embed: async (text: string) => {
            if (text === "Review candidate logic") return [1, 0];
            if (text === "Challenge claim inference")
              return mode === "dimensions"
                ? [1]
                : mode === "overflow"
                  ? [Number.MAX_VALUE, Number.MAX_VALUE]
                  : mode === "zero"
                    ? [0, 0]
                    : [score, Math.sqrt(1 - score * score)];
            return [0, 1];
          },
        },
      ],
    };
    let server = await startServer(home, backend, options);
    const client = createRunClient(home);
    try {
      const run = await client.submit({
        project: root,
        workflow,
        backend: Backend.Fake,
        client_id: "merge-owner",
        submission_id: "merge-run",
      });
      assert(
        await waitUntil(async () =>
          [RunStatus.Passed, RunStatus.Blocked].includes((await client.get(run.run_id)).state),
        ),
      );
      await server.stop();
      server = await startServer(home, backend, options);
      const final = await client.get(run.run_id);
      const invalid = ["dimensions", "zero", "overflow", "capacity"].includes(mode);
      assert.equal(final.state, invalid ? RunStatus.Blocked : RunStatus.Passed);
      const page = await createRequestClient(home).list({ run_id: run.run_id });
      const requests = page.requests
        .map((item) => item.request)
        .filter((request) => request.kind === RequestKind.MergePersonas);
      assert.equal(
        requests.length,
        ["match", "boundary", "same"].includes(mode) ? 1 : 0,
        JSON.stringify(page),
      );
      if (requests[0]) {
        assert.equal(requests[0].scope.resource, "doubter@1,skeptic@1");
        assert.equal(requests[0].answer, null);
      }
      return true;
    } finally {
      await server.stop();
    }
  });
}
