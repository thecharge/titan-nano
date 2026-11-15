import { strict as assert } from "node:assert";
import { readFile, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  ExecutionPhase,
  Packaging,
  RequestDecision,
  RequestKind,
  RunStatus,
  UsageBackendSource,
  Verdict,
} from "@titan/constants";
import { KnowledgeHub, ownedKnowledge, personaEntryId } from "@titan/knowledge";
import { Engine } from "@titan/runner";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendId,
  type PersonaBinding,
  PersonaInspectionSchema,
  PersonaRecordSchema,
  type Usage,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { runCliCommand } from "../support/command.ts";

export async function usageSemantics(
  source: UsageBackendSource,
  backend: BackendId,
  reports: Usage[],
  reload = false,
  switched?: BackendId,
) {
  return withTemporaryDirectory(async (project) => {
    assert.equal(reports.length, 3);
    let calls = 0;
    const fake = new FakeBackend(async (spec) => {
      if (!spec.writable)
        return {
          json: {
            result: { verdict: Verdict.Survived, evidence: "Checked usage candidate" },
            requests: [],
          },
          usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
        };
      const usage = reports[calls++];
      assert.ok(usage);
      return {
        usage,
        json:
          calls === reports.length
            ? { result: { ok: true, marker: "usage", turn: calls }, requests: [] }
            : {
                result: null,
                requests: [
                  {
                    kind: RequestKind.Resource,
                    scope: {
                      operation: "read",
                      resource: "reference",
                      content_hashes: {},
                      arguments: [],
                      environment_names: [],
                    },
                    expires_at: Date.now() + 60000,
                  },
                ],
              },
      };
    });
    const factory = () => fake;
    const workflow = vendorRecoveryWorkflow();
    const config = await resolveConfig({
      home: resolve(project, "home"),
      project,
      overrides: source === UsageBackendSource.Defaults ? { defaults: { backend } } : {},
    });
    const plan = validateWorkflow({
      ...workflow,
      personas: {
        worker: {
          ...workflow.personas.worker,
          request_turns: true,
          ...(source === UsageBackendSource.Persona ? { backend } : {}),
        },
        checker: { ...workflow.personas.checker, request_turns: true, backend: Backend.Fake },
      },
    });
    const home = resolve(project, "home");
    const hub = await KnowledgeHub.open(home);
    let binding: PersonaBinding;
    try {
      binding = await hub.bindPersonas(plan.workflow);
    } finally {
      await hub.close();
    }
    const knowledge = ownedKnowledge(
      home,
      config.value.server.knowledge ?? {},
      config.value.server.native_tools.max_pending_operations,
    );
    const services = { personaHistory: knowledge.personaHistory };
    let owner = new Engine(factory, {}, services);
    const run = await owner.create({
      project,
      plan,
      persona_references: binding.references,
      config,
      backend: source === UsageBackendSource.Run ? backend : Backend.Fake,
      client_id: "usage-semantics",
      submission_id: "usage-semantics",
    });
    await owner.start(run.run_id);
    for (let index = 1; index < reports.length; index++) {
      assert.equal(owner.get(run.run_id).state, RunStatus.Waiting);
      const pending = (await owner.requests.list(run.run_id)).filter(
        (request) => request.answer === null,
      );
      assert.equal(pending.length, 1);
      const request = pending[0];
      assert.ok(request);
      await owner.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Deny,
          reason: "Record decision without an operation",
        },
        { client_id: "usage-reviewer", authority: ApprovalLevel.Main },
      );
      if (reload) {
        owner = new Engine(factory, {}, services);
        await owner.load(run.root);
      }
      await owner.resume(run.run_id, index === reports.length - 1 ? switched : undefined);
    }
    assert.equal(calls, 3);
    const final = owner.get(run.run_id);
    assert.equal(final.state, RunStatus.Passed);
    assert.deepEqual(
      final.nodes.deliver?.phases[ExecutionPhase.Worker]?.usage,
      switched ? reports.slice(-1) : reports,
    );
    const report = await owner.usage(run.run_id);
    assert.equal(report.executions, 4);
    assert.equal(report.reported_executions, 4);
    assert.equal(report.unreported_executions, 0);
    const restored = new Engine(factory, {}, services);
    await restored.load(run.root);
    assert.deepEqual(await restored.usage(run.run_id), report);
    const saved = await KnowledgeHub.open(home);
    try {
      const reference = binding.references.worker;
      assert.ok(reference);
      const entry = (await saved.get(personaEntryId(reference))).entry;
      const persona = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
      assert.equal(persona.usage?.executions, 3);
      assert.equal(persona.usage?.reported_executions, 3);
      assert.equal(persona.usage?.unreported_executions, 0);
      assert.deepEqual(persona.usage?.known, report.known);
      assert.deepEqual(persona.usage?.complete, report.complete);
      assert.equal(persona.usage?.reports.length, 1);
      const shown = PersonaInspectionSchema.parse(
        await runCliCommand(Packaging.CliSource, home, ["persona", "show", "worker"]),
      );
      assert.deepEqual(shown.versions[0]?.usage, persona.usage);
    } finally {
      await saved.close();
    }
    return { known: report.known, complete: report.complete };
  });
}

export async function reconciliationUsage(backend: BackendId, reports: Usage[]) {
  return withTemporaryDirectory(async (project) => {
    await writeFile(resolve(project, "note.txt"), "Original input");
    let originals = 0;
    let turns = 0;
    const factory = () =>
      new FakeBackend(async (spec, prompt) => {
        const task = JSON.parse(prompt);
        if (!spec.writable)
          return {
            json: { verdict: Verdict.Survived, evidence: "Checked recovered files" },
            usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
          };
        if (!task.reconciliation) {
          originals++;
          await symlink("note.txt", resolve(project, "unsafe-link"));
          return {
            json: { ok: true },
            usage: { input_tokens: 5, output_tokens: 2, cost_usd: 0.125 },
          };
        }
        const usage = reports[turns++];
        assert.ok(usage);
        return {
          usage,
          json:
            turns === reports.length
              ? { result: { ok: true }, requests: [] }
              : {
                  result: null,
                  requests: [
                    {
                      kind: RequestKind.Resource,
                      scope: {
                        operation: "read",
                        resource: "reference",
                        content_hashes: {},
                        arguments: [],
                        environment_names: [],
                      },
                      expires_at: Date.now() + 60000,
                    },
                  ],
                },
        };
      });
    const config = await resolveConfig({ home: resolve(project, "home"), project });
    let owner = new Engine(factory);
    const run = await owner.create({
      project,
      config,
      backend: Backend.Fake,
      client_id: "recovery-usage",
      submission_id: "recovery-usage",
      plan: validateWorkflow({
        name: "Recovery usage",
        goal: "Account for the selected recovery backend",
        personas: {
          worker: { description: "Writer", role: "Deliver", tools: [AgentTool.Write] },
          merger: {
            description: "Merger",
            role: "Reconcile",
            tools: [AgentTool.Write],
            backend,
            request_turns: true,
          },
          checker: { description: "Checker", role: "Challenge" },
        },
        steps: [
          {
            id: "deliver",
            do: { persona: "worker", task: "Deliver once" },
            reconcile: { persona: "merger", task: "Merge retained files" },
            falsify: [{ persona: "checker", task: "Challenge recovered files" }],
          },
        ],
      }),
    });
    await owner.start(run.run_id);
    assert.equal(run.state, RunStatus.Blocked);
    await rm(resolve(project, "unsafe-link"));
    await writeFile(resolve(project, "note.txt"), "External edit");
    owner = new Engine(factory);
    await owner.load(run.root);
    await owner.resume(run.run_id);
    for (let index = 1; index < reports.length; index++) {
      assert.equal(owner.get(run.run_id).state, RunStatus.Waiting);
      const request = (await owner.requests.list(run.run_id)).find(
        (entry) => entry.answer === null,
      );
      assert.ok(request);
      await owner.requests.answer(
        {
          run_id: run.run_id,
          request_id: request.request_id,
          version: request.version,
          decision: RequestDecision.Deny,
          reason: "Record decision without an operation",
        },
        { client_id: "owner", authority: ApprovalLevel.Main },
      );
      owner = new Engine(factory);
      await owner.load(run.root);
      await owner.resume(run.run_id);
    }
    assert.equal(originals, 1);
    assert.equal(turns, 3);
    assert.equal(owner.get(run.run_id).state, RunStatus.Passed);
    assert.equal(await readFile(resolve(project, "note.txt"), "utf8"), "External edit");
    const report = await owner.usage(run.run_id);
    assert.equal(report.executions, 5);
    assert.equal(report.reported_executions, 5);
    assert.equal(report.unreported_executions, 0);
    const restored = new Engine(factory);
    await restored.load(run.root);
    assert.deepEqual(await restored.usage(run.run_id), report);
    return { known: report.known, complete: report.complete };
  });
}
