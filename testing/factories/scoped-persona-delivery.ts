import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  ApprovalLevel,
  Backend,
  RequestDecision,
  RequestKind,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { inspectPersona, projectHubHome, registerPersonas } from "@titan/knowledge";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSchema, WorkflowSchema } from "@titan/types";
import { openServer } from "./server-run-hub.ts";

export function scopedPersonaDelivery(scope: string, deleting: boolean) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = scope === "shared" ? projectHubHome(project) : resolve(root, "home");
    await mkdir(project);
    for (const [directory, role] of scope === "shared"
      ? [[home, "Project definition"]]
      : [
          [home, "Home definition"],
          [projectHubHome(project), "Project definition"],
        ]) {
      assert(directory);
      await registerPersonas(
        directory,
        WorkflowSchema.parse({
          name: "Seed the persona",
          goal: "Retain the scoped definition",
          personas: { worker: { description: "Scoped worker", role } },
          steps: [{ id: "seed", do: { persona: "worker", task: "Seed the definition" } }],
        }),
      );
    }
    const reference = scope !== "home" ? "project:worker@1" : "worker@1";
    const body = {
      project,
      backend: Backend.Fake,
      client_id: "scope-owner",
      submission_id: "scope-first",
      workflow: {
        name: "Use the selected persona",
        goal: "Keep its exact identity",
        personas: {
          worker: { use: reference },
          checker: { description: "Check the result", role: "Independent scoped review" },
        },
        steps: [
          {
            id: "work",
            do: { persona: "worker", task: "Return the result" },
            falsify: [{ persona: "checker", task: "Inspect the result" }],
          },
        ],
      },
    };
    const roles: string[] = [];
    const backend = () =>
      new FakeBackend(async (spec) => {
        if (spec.persona_id === "worker") roles.push(spec.role);
        return {
          json:
            spec.persona_id === "worker"
              ? { ok: true }
              : { verdict: Verdict.Survived, evidence: "Checked the scoped result" },
        };
      });
    let server = await openServer(home, backend);
    const client = createRunClient(home);
    try {
      const initial = await client.submit(body);
      assert(
        await waitUntil(async () => (await client.get(initial.run_id)).state === RunStatus.Passed),
      );
      const run = RunSchema.parse(await client.get(initial.run_id));
      assert.equal(run.persona_references?.worker, reference);
      assert.deepEqual(roles, [scope !== "home" ? "Project definition" : "Home definition"]);
      const selected = scope !== "home" ? projectHubHome(project) : home;
      const other = scope !== "home" ? home : projectHubHome(project);
      const before = (await inspectPersona(selected, { selector: "worker@1" })).versions[0];
      assert.equal(before?.history?.length, 1);
      assert.equal(before?.history?.[0]?.persona, reference);
      assert.equal(before?.usage?.executions, 1);
      if (scope !== "shared")
        assert.equal(
          (await inspectPersona(other, { selector: "worker@1" })).versions[0]?.history?.length,
          0,
        );
      if (deleting) {
        const requests = createRequestClient(home);
        const request = await requests.open(run.run_id, {
          request_id: "scope-delete",
          kind: RequestKind.DeletePersona,
          scope: {
            operation: RequestKind.DeletePersona,
            resource: reference,
            content_hashes: {},
            arguments: [],
            environment_names: [],
          },
          origin: { client_id: "scope-owner", harness_session_id: null },
          expires_at: Date.now() + 60000,
        });
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: request.request_id,
            version: request.version,
            decision: RequestDecision.Approve,
            reason: "Synthetic approved deletion",
            client_id: "scope-owner",
          },
          ApprovalLevel.Human,
        );
      }
      await server.stop();
      server = await openServer(home, backend);
      assert.equal((await client.get(initial.run_id)).run_id, initial.run_id);
      if (deleting) {
        await assert.rejects(client.submit({ ...body, submission_id: "scope-after-delete" }));
        assert.equal(roles.length, 1);
        if (scope !== "shared")
          assert.equal(
            (await inspectPersona(other, { selector: "worker@1" })).versions[0]?.history?.length,
            0,
          );
      } else {
        assert.equal((await client.submit(body)).run_id, initial.run_id);
        assert.deepEqual(
          (await inspectPersona(selected, { selector: "worker@1" })).versions[0],
          before,
        );
      }
      return true;
    } finally {
      await server.stop();
    }
  });
}
