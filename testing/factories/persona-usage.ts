import { strict as assert } from "node:assert";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import {
  Backend,
  ErrorCode,
  Packaging,
  PersonaRegister,
  RunAction,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { KnowledgeHub, personaEntryId } from "@titan/knowledge";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendId,
  type KnowledgeEntry,
  PersonaInspectionSchema,
  PersonaRecordSchema,
  PersonaUsageReportSchema,
  RunSchema,
  WorkflowSchema,
} from "@titan/types";
import { runCliCommand } from "../support/command.ts";

function usageWorkflow(backend: BackendId) {
  return WorkflowSchema.parse({
    name: PersonaRegister.WorkflowName,
    goal: PersonaRegister.Goal,
    personas: {
      [PersonaRegister.Judge]: {
        description: PersonaRegister.Description,
        role: PersonaRegister.RoleFirst,
        backend,
      },
      [PersonaRegister.Checker]: {
        description: PersonaRegister.Description,
        role: PersonaRegister.CheckerRole,
        backend: Backend.Fake,
      },
    },
    steps: [1, 2, 3].map((index) => ({
      id: `${PersonaRegister.StepId}-${index}`,
      do: { persona: PersonaRegister.Judge, task: PersonaRegister.Task },
      falsify: [{ persona: PersonaRegister.Checker, task: PersonaRegister.Check }],
    })),
  });
}

export function personaUsageProduction(
  backend: BackendId,
  unknown = false,
  interrupted = false,
  legacy = false,
) {
  return withTemporaryDirectory(async (home) => {
    const workflow = usageWorkflow(backend);
    const initial = await KnowledgeHub.open(home);
    try {
      await initial.registerPersonas(workflow);
      if (legacy) {
        const { entry } = await initial.get(personaEntryId(PersonaRegister.JudgeFirst));
        const body = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
        delete body.usage;
        const { id, version, ...draft } = entry;
        await initial.update({
          id,
          version,
          entry: { ...draft, body: Bun.YAML.stringify(body) },
        });
      }
    } finally {
      await initial.close();
    }
    let waiting = false;
    let executions = 0;
    const factory = () =>
      new FakeBackend(async (spec, _prompt, signal) => {
        executions++;
        if (spec.persona_id !== PersonaRegister.Judge)
          return {
            json: { verdict: Verdict.Survived, evidence: PersonaRegister.Evidence },
            usage: { input_tokens: 2, output_tokens: 1, cost_usd: 0.03125 },
          };
        if (interrupted) {
          waiting = true;
          await new Promise<void>((done) =>
            signal.addEventListener("abort", () => done(), { once: true }),
          );
          signal.throwIfAborted();
        }
        return {
          json: { note: PersonaRegister.Note },
          usage: { input_tokens: 13, output_tokens: 5, cost_usd: unknown ? null : 0.125 },
        };
      });
    let server = await startServer(home, factory);
    await using resources = new AsyncDisposableStack();
    resources.defer(() => server.stop());
    const body = {
      project: home,
      workflow,
      backend: Backend.Fake,
      client_id: PersonaRegister.Judge,
      submission_id: PersonaRegister.StepId,
    };
    const client = createRunClient(home);
    const run = await client.submit(body);
    if (interrupted) {
      assert(await waitUntil(async () => waiting));
      await client.control(run.run_id, RunAction.Cancel);
    }
    assert(
      await waitUntil(
        async () =>
          (await client.get(run.run_id)).state ===
          (interrupted ? RunStatus.Cancelled : RunStatus.Passed),
      ),
    );
    await server.stop();
    const hub = await KnowledgeHub.open(home);
    let before: KnowledgeEntry;
    try {
      before = (await hub.get(personaEntryId(PersonaRegister.JudgeFirst))).entry;
      const worker = PersonaRecordSchema.parse(Bun.YAML.parse(before.body));
      const usage = worker.usage;
      assert(usage);
      assert.equal(usage.history_complete, !legacy);
      assert.equal(usage.executions, interrupted ? 1 : 3);
      assert.equal(usage.reported_executions, interrupted ? 0 : 3);
      assert.equal(usage.unreported_executions, interrupted ? 1 : 0);
      assert.equal(usage.reports.length, 1);
      assert.equal(usage.reports[0]?.run_id, run.run_id);
      assert.deepEqual(usage.known, {
        input_tokens: interrupted ? 0 : 39,
        output_tokens: interrupted ? 0 : 15,
        cost_usd: interrupted || unknown ? 0 : 0.375,
      });
      assert.deepEqual(usage.complete, {
        input_tokens: !interrupted && !legacy,
        output_tokens: !interrupted && !legacy,
        cost_usd: !interrupted && !legacy && !unknown,
      });
      assert.equal(worker.uses ?? 0, interrupted ? 0 : 3);
      const checker = PersonaRecordSchema.parse(
        Bun.YAML.parse((await hub.get(personaEntryId(`${PersonaRegister.Checker}@1`))).entry.body),
      );
      assert.equal(checker.usage?.executions, interrupted ? 0 : 3);
      assert.equal(checker.usage?.known.input_tokens, interrupted ? 0 : 6);
      const shown = PersonaInspectionSchema.parse(
        await runCliCommand(Packaging.CliSource, home, ["persona", "show", PersonaRegister.Judge]),
      );
      assert.deepEqual(shown.versions[0]?.usage, usage);
    } finally {
      await hub.close();
    }
    server = await startServer(home, factory);
    assert.equal((await client.submit(body)).run_id, run.run_id);
    await server.stop();
    const restored = await KnowledgeHub.open(home);
    try {
      assert.deepEqual((await restored.get(before.id)).entry, before);
      assert.equal(executions, interrupted ? 1 : 6);
    } finally {
      await restored.close();
    }
    return true;
  });
}

export function personaUsageReplay(mode: number) {
  return withTemporaryDirectory(async (home) => {
    const server = await startServer(
      home,
      () =>
        new FakeBackend(async (spec) => ({
          json:
            spec.persona_id === PersonaRegister.Judge
              ? { note: PersonaRegister.Note }
              : { verdict: Verdict.Survived, evidence: PersonaRegister.Evidence },
          usage: { input_tokens: 13, output_tokens: 5, cost_usd: 0.125 },
        })),
    );
    await using resources = new AsyncDisposableStack();
    resources.defer(() => server.stop());
    const client = createRunClient(home);
    const submitted = await client.submit({
      project: home,
      workflow: usageWorkflow(Backend.Codex),
      backend: Backend.Fake,
      client_id: PersonaRegister.Judge,
      submission_id: PersonaRegister.StepId,
    });
    assert(
      await waitUntil(async () => (await client.get(submitted.run_id)).state === RunStatus.Passed),
    );
    const run = RunSchema.parse(await client.get(submitted.run_id));
    if (mode === 8) {
      const next = await client.submit({
        project: home,
        workflow: usageWorkflow(Backend.Codex),
        backend: Backend.Fake,
        client_id: PersonaRegister.Judge,
        submission_id: `${PersonaRegister.StepId}-2`,
      });
      assert(
        await waitUntil(async () => (await client.get(next.run_id)).state === RunStatus.Passed),
      );
    }
    await server.stop();
    const hub = await KnowledgeHub.open(home);
    try {
      let before = (await hub.get(personaEntryId(PersonaRegister.JudgeFirst))).entry;
      if (mode === 9 || mode === 12) {
        const body = PersonaRecordSchema.parse(Bun.YAML.parse(before.body));
        const receipt = body.usage?.reports[0];
        assert(receipt);
        if (mode === 9) {
          delete receipt.asked;
          delete body.asked_history_complete;
        } else receipt.asked = 2;
        const { id, version, ...draft } = before;
        await hub.update({ id, version, entry: { ...draft, body: Bun.YAML.stringify(body) } });
        before = (await hub.get(id)).entry;
      }
      const saved = PersonaRecordSchema.parse(Bun.YAML.parse(before.body)).usage?.reports[0];
      assert(saved);
      if (mode === 8) {
        const usage = PersonaRecordSchema.parse(Bun.YAML.parse(before.body)).usage;
        assert.equal(usage?.reports.length, 2);
        assert.equal(usage?.executions, 6);
        assert.equal(usage?.known.input_tokens, 78);
      }
      const report = PersonaUsageReportSchema.parse({
        ...saved,
        persona: PersonaRegister.JudgeFirst,
      });
      if (mode === 1) report.through--;
      if (mode === 2) report.known.input_tokens++;
      if (mode === 3) {
        report.through++;
        report.known.input_tokens--;
      }
      if (mode === 4) report.run_id = PersonaRegister.Strays;
      if (mode === 5) report.through = run.version + 1;
      if (mode === 6) report.persona = `${PersonaRegister.Strays}@1`;
      if (mode === 7) {
        report.through++;
        report.known.input_tokens++;
      }
      if (mode === 9) report.asked = 0;
      if (mode === 10) report.asked = 1;
      if (mode === 11) delete report.asked;
      if (mode === 12) report.asked = 1;
      if (mode === 13) report.asked = 1;
      if (mode >= 11) report.through++;
      const retained = RunSchema.parse({
        ...run,
        version:
          mode === 3 || mode === 7 || mode >= 11
            ? Math.max(run.version, report.through)
            : run.version,
      });
      const publish = () =>
        hub.recordPersonaHistory(retained, new RunStore(run.root).events(run.version), undefined, [
          report,
        ]);
      if ((mode >= 2 && mode <= 6) || (mode >= 10 && mode <= 12))
        await assert.rejects(publish(), { code: ErrorCode.KnowledgeCorrupt });
      else await publish();
      const after = (await hub.get(before.id)).entry;
      if (mode === 7) {
        const usage = PersonaRecordSchema.parse(Bun.YAML.parse(after.body)).usage;
        assert.equal(after.version, before.version + 1);
        assert.equal(usage?.reports.length, 1);
        assert.equal(usage?.executions, saved.executions);
        assert.equal(usage?.known.input_tokens, report.known.input_tokens);
        assert.equal(usage?.reports[0]?.through, report.through);
      } else if (mode === 9 || mode === 13) {
        const record = PersonaRecordSchema.parse(Bun.YAML.parse(after.body));
        assert.equal(after.version, before.version + 1);
        assert.equal(record.asked, mode === 13 ? 1 : 0);
        assert.equal(record.asked_history_complete, mode !== 9);
        assert.equal(record.usage?.reports[0]?.asked, report.asked);
      } else assert.deepEqual(after, before);
      return true;
    } finally {
      await hub.close();
    }
  });
}
