import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  ApprovalLevel,
  Backend,
  ErrorCode,
  ExecutionPhase,
  FakeScriptLimit,
  KnowledgeKind,
  KnowledgePublicationStage,
  KnowledgeSearchMode,
  NativeToolRole,
  Packaging,
  PersonaRegister,
  PersonaState,
  RequestDecision,
  RequestKind,
  RequestLimit,
  RunAction,
  RunEventKind,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { hash } from "@titan/core";
import { inspectPersona, KnowledgeHub, personaEntryId, registerPersonas } from "@titan/knowledge";
import { Engine } from "@titan/runner";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendFactory,
  KnowledgeSearchPageSchema,
  PersonaInspectionSchema,
  PersonaJudgementSchema,
  PersonaQualityResultSchema,
  PersonaRecordSchema,
  type PersonaRequestWriter,
  type Run,
  type RunEvent,
  RunSchema,
  type Workflow,
  WorkflowSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { runCliCommand } from "../support/command.ts";
import { openServer } from "./server-run-hub.ts";

export function personaLaterResult(
  role: NativeToolRole,
  verdict: Verdict,
  later: boolean,
): boolean {
  return PersonaQualityResultSchema.safeParse({
    persona: `${PersonaRegister.Checker}@1`,
    run: PersonaRegister.StepId,
    step: PersonaRegister.StepId,
    part: `${ExecutionPhase.FalsifierPrefix}0`,
    candidate: hash(PersonaRegister.Note),
    attempt: 1,
    generation: 0,
    role,
    verdict,
    ...(later ? { later_refuted: true } : {}),
  }).success;
}

function workflow(split = false) {
  const persona = { description: PersonaRegister.Description, role: PersonaRegister.RoleFirst };
  return WorkflowSchema.parse({
    name: PersonaRegister.WorkflowName,
    goal: PersonaRegister.Goal,
    personas: {
      [PersonaRegister.Judge]: persona,
      [PersonaRegister.Checker]: { ...persona, role: PersonaRegister.CheckerRole },
    },
    steps: (split ? [1, 2] : [1, 2, 3]).map((index) => ({
      id: `${PersonaRegister.StepId}-${index}`,
      do: { persona: PersonaRegister.Judge, task: PersonaRegister.Task },
      falsify: [{ persona: PersonaRegister.Checker, task: PersonaRegister.Check }],
      max_attempts: 1,
      ...(split && index === 2
        ? { split: { parts: `${PersonaRegister.StepId}-1.parts`, width: 1 } }
        : {}),
    })),
  });
}

async function record(hub: KnowledgeHub, reference: string) {
  const { entry } = await hub.get(personaEntryId(reference));
  return PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
}

async function seedPersonaCounts(
  hub: KnowledgeHub,
  state: PersonaState,
  survived: number,
  refuted: number,
): Promise<void> {
  const { entry } = await hub.get(personaEntryId(PersonaRegister.JudgeFirst));
  await hub.update({
    id: entry.id,
    version: entry.version,
    entry: {
      kind: entry.kind,
      title: entry.title,
      tags: entry.tags,
      body: Bun.YAML.stringify({
        ...PersonaRecordSchema.parse(Bun.YAML.parse(entry.body)),
        state,
        survived,
        refuted,
      }),
    },
  });
}

export async function personaLifecycleDelivery(
  state: PersonaState,
  before: boolean,
  after: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, PersonaRegister.Strays);
    const base = workflow();
    assert(base.steps);
    const plan = validateWorkflow({ ...base, steps: base.steps.slice(0, 1) });
    let hub = await KnowledgeHub.open(home);
    const references = await hub.registerPersonas(plan.workflow);
    await seedPersonaCounts(hub, state, 1, 6);
    let executions = 0;
    let failed = false;
    const backend = () =>
      new FakeBackend(async (spec) => {
        executions++;
        return spec.persona_id === PersonaRegister.Judge
          ? { json: { note: PersonaRegister.Note } }
          : { json: { verdict: Verdict.Refuted, evidence: PersonaRegister.Evidence } };
      });
    const services = {
      runtimePaths: [home],
      personaHistory: (run: Run, events: AsyncIterable<RunEvent>, request?: PersonaRequestWriter) =>
        hub.recordPersonaHistory(run, events, async (run, update) => {
          if (before && !failed) {
            failed = true;
            throw new Error(PersonaRegister.Broken);
          }
          await request?.(run, update);
          if (after && !failed) {
            failed = true;
            throw new Error(PersonaRegister.Broken);
          }
        }),
    };
    const engine = new Engine(backend, {}, services);
    const run = await engine.create({
      project: root,
      plan,
      persona_references: references,
      config: await resolveConfig({ home, project: root }),
      backend: Backend.Fake,
      client_id: PersonaRegister.Judge,
      submission_id: PersonaRegister.StepId,
    });
    try {
      await engine.start(run.run_id);
      assert.equal(run.state, before || after ? RunStatus.Blocked : RunStatus.Failed);
      assert.equal(run.pending_journal?.state, before || after ? RunStatus.Failed : undefined);
      await hub.close();
      hub = await KnowledgeHub.open(home);
      const restored = new Engine(backend, {}, services);
      const saved = await restored.load(run.root);
      if (before || after) await restored.resume(run.run_id);
      assert.equal(saved.state, RunStatus.Failed);
      assert.equal(saved.pending_journal, undefined);
      const requests = await restored.requests.list(run.run_id);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.kind, RequestKind.ImprovePersona);
      assert.equal(executions, 2);
      const worker = await record(hub, PersonaRegister.JudgeFirst);
      assert.equal(worker.state, PersonaState.NeedsUpdate);
      assert.equal(worker.survived, 1);
      assert.equal(worker.refuted, 7);
      assert.equal(worker.transitions?.length, 1);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function personaProductionLifecycle(
  state: PersonaState,
  survived: number,
  refuted: number,
  fails: boolean,
  expected: PersonaState,
  replay: boolean,
  large = false,
  cli?: string,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const base = workflow();
    assert(base.steps);
    const plan = WorkflowSchema.parse({ ...base, steps: base.steps.slice(0, 1) });
    const hub = await KnowledgeHub.open(home);
    try {
      await hub.registerPersonas(plan);
      await seedPersonaCounts(hub, state, survived, refuted);
    } finally {
      await hub.close();
    }
    let executions = 0;
    const evidence = large
      ? PersonaRegister.Evidence.repeat(RequestLimit.TextCharacters + 1)
      : PersonaRegister.Evidence;
    const backend = () =>
      new FakeBackend(async (spec) => {
        executions++;
        return spec.persona_id === PersonaRegister.Judge
          ? { json: { note: PersonaRegister.Note } }
          : {
              json: {
                verdict: fails ? Verdict.Refuted : Verdict.Survived,
                evidence,
              },
            };
      });
    let server = await openServer(home, backend, cli);
    await using resources = new AsyncDisposableStack();
    resources.defer(() => server.stop());
    const body = {
      project: home,
      workflow: {
        ...plan,
        ...(cli
          ? {
              backends: {
                fake: {
                  script: {
                    version: FakeScriptLimit.Version,
                    answers: [
                      {
                        persona: PersonaRegister.Judge,
                        task: PersonaRegister.Task,
                        answer: { note: PersonaRegister.Note },
                      },
                      {
                        persona: PersonaRegister.Checker,
                        task: PersonaRegister.Check,
                        answer: { verdict: fails ? Verdict.Refuted : Verdict.Survived, evidence },
                      },
                    ],
                  },
                },
              },
            }
          : {}),
      },
      backend: Backend.Fake,
      client_id: PersonaRegister.Judge,
      submission_id: PersonaRegister.StepId,
    };
    const client = createRunClient(home);
    const run = await client.submit(body);
    assert(
      await waitUntil(
        async () =>
          (await client.get(run.run_id)).state === (fails ? RunStatus.Failed : RunStatus.Passed),
      ),
    );
    if (replay) {
      await server.stop();
      server = await openServer(home, backend, cli);
      assert.equal((await client.submit(body)).run_id, run.run_id);
    }
    const requests = (await createRequestClient(home).list({ run_id: run.run_id })).requests;
    const improves = expected === PersonaState.NeedsUpdate;
    assert.equal(requests.length, improves ? 1 : 0);
    if (improves) {
      assert.equal(requests[0]?.request.kind, RequestKind.ImprovePersona);
      assert.equal(requests[0]?.request.scope.arguments[0], PersonaRegister.JudgeFirst);
      const evidence = JSON.parse(
        requests[0]?.request.scope.arguments[1] ?? PersonaRegister.Broken,
      );
      assert.equal(evidence.refutations, refuted + 1);
      assert.equal(evidence.run_id, run.run_id);
      assert(Number.isSafeInteger(evidence.through));
    }
    if (!cli) assert.equal(executions, 2);
    const terminal = RunSchema.parse(await client.get(run.run_id));
    const phases = terminal.nodes[`${PersonaRegister.StepId}-1`]?.phases;
    assert.equal(phases?.[ExecutionPhase.Worker]?.executions, 1);
    assert.equal(phases?.[`${ExecutionPhase.FalsifierPrefix}0`]?.executions, 1);
    if (fails)
      assert.deepEqual(terminal.nodes[`${PersonaRegister.StepId}-1`]?.evidence, [evidence]);
    await server.stop();
    const saved = await KnowledgeHub.open(home);
    try {
      const worker = await record(saved, PersonaRegister.JudgeFirst);
      assert.equal(worker.usage?.executions, 1);
      assert.equal(worker.usage?.reported_executions, 1);
      assert.equal(worker.usage?.unreported_executions, 0);
      assert.equal(worker.usage?.reports.length, 1);
      assert.equal(worker.usage?.reports[0]?.run_id, run.run_id);
      assert.deepEqual(worker.usage?.complete, {
        input_tokens: false,
        output_tokens: false,
        cost_usd: false,
      });
      const checker = await record(saved, `${PersonaRegister.Checker}@1`);
      assert.equal(checker.usage?.executions, 1);
      assert.equal(checker.usage?.reported_executions, 1);
      if (cli) {
        const page = PersonaInspectionSchema.parse(
          await runCliCommand(cli, home, ["persona", "show", PersonaRegister.Judge]),
        );
        assert.deepEqual(page.versions[0], { ...worker, uses: survived + refuted + 1 });
      }
      assert.equal(worker.state, expected);
      assert.equal(worker.survived, survived + Number(!fails));
      assert.equal(worker.refuted, refuted + Number(fails));
      assert.equal(worker.transitions?.length ?? 0, state === expected ? 0 : 1);
      const transition = worker.transitions?.[0];
      if (state !== expected) {
        assert.equal(transition?.move.from, state);
        assert.equal(transition?.move.to, expected);
        assert.equal(transition?.move.total, survived + refuted + 1);
        assert.equal(transition?.run, run.run_id);
      }
      const before = (await saved.get(personaEntryId(PersonaRegister.JudgeFirst))).entry;
      await saved.recordPersonaHistory(terminal, new RunStore(terminal.root).events());
      assert.deepEqual((await saved.get(before.id)).entry, before);
      return true;
    } finally {
      await saved.close();
    }
  });
}

export async function personaLifecycleProcess(
  state: PersonaState,
  survived: number,
  refuted: number,
  fails: boolean,
  expected: PersonaState,
  replay: boolean,
  large: boolean,
  cli = resolve(Packaging.CliSource),
) {
  return personaProductionLifecycle(state, survived, refuted, fails, expected, replay, large, cli);
}

async function completed(
  home: string,
  refuted: boolean,
  interrupted: boolean,
  checker: boolean,
  split = false,
  second = false,
) {
  const base = workflow(split);
  if (second)
    await registerPersonas(
      home,
      WorkflowSchema.parse({
        ...base,
        personas: {
          ...base.personas,
          [PersonaRegister.Judge]: {
            description: PersonaRegister.Description,
            role: PersonaRegister.RoleSecond,
          },
        },
      }),
    );
  let waiting = false;
  const factory = () =>
    new FakeBackend(async (spec, _prompt, signal) => {
      const worker = spec.persona_id === PersonaRegister.Judge;
      if (interrupted && worker !== checker) {
        waiting = true;
        await new Promise<void>((done) =>
          signal.addEventListener("abort", () => done(), { once: true }),
        );
        signal.throwIfAborted();
      }
      if (worker)
        return { json: { note: PersonaRegister.Note, ...(split ? { parts: [1, 2] } : {}) } };
      return {
        json: {
          verdict:
            refuted && spec.invocation_id.startsWith(`${PersonaRegister.StepId}-${split ? 2 : 3}/`)
              ? Verdict.Refuted
              : Verdict.Survived,
          evidence: PersonaRegister.Evidence,
        },
      };
    });
  const body = {
    project: home,
    workflow: base,
    backend: Backend.Fake,
    client_id: PersonaRegister.Judge,
    submission_id: PersonaRegister.StepId,
  };
  const server = await startServer(home, factory);
  const client = createRunClient(home);
  let run: Run;
  try {
    run = RunSchema.parse(await client.submit(body));
    if (interrupted) {
      assert.ok(await waitUntil(async () => waiting));
      await client.control(run.run_id, RunAction.Cancel);
    }
    const state = interrupted ? RunStatus.Cancelled : refuted ? RunStatus.Failed : RunStatus.Passed;
    assert.ok(await waitUntil(async () => (await client.get(run.run_id)).state === state));
  } finally {
    await server.stop();
  }
  const restarted = await startServer(home, factory);
  try {
    run = RunSchema.parse(await createRunClient(home).submit(body));
    return run;
  } finally {
    await restarted.stop();
  }
}

export async function personaProductionHistory(
  refuted: boolean,
  interrupted: boolean,
  second = false,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const run = await completed(home, refuted, interrupted, refuted, false, second);
    const reference = second ? PersonaRegister.JudgeSecond : PersonaRegister.JudgeFirst;
    const hub = await KnowledgeHub.open(home);
    try {
      const worker = await record(hub, reference);
      const checker = await record(hub, `${PersonaRegister.Checker}@1`);
      const shown = PersonaInspectionSchema.parse(
        await runCliCommand(Packaging.CliSource, home, ["persona", "show", PersonaRegister.Judge]),
      ).versions[0];
      assert.equal(shown?.uses, interrupted ? 0 : 3);
      assert.equal(shown?.survived, interrupted ? 0 : refuted ? 2 : 3);
      assert.equal(shown?.refuted, interrupted ? 0 : refuted ? 1 : 0);
      assert.equal(shown?.version, second ? 2 : 1);
      assert.equal(worker.history?.length, interrupted ? 0 : 3);
      assert.equal(checker.history?.length, interrupted ? 0 : 3);
      assert.equal(worker.uses ?? 0, interrupted ? 0 : 3);
      assert.equal(checker.uses ?? 0, interrupted ? 0 : 3);
      if (!interrupted) {
        assert.equal(worker.survived, refuted ? 2 : 3);
        assert.equal(worker.refuted, refuted ? 1 : 0);
        assert.equal(worker.runs, 1);
        assert.equal(checker.falsifier_refutations, refuted ? 1 : 0);
        assert.equal(checker.survived, 0);
        const matches = KnowledgeSearchPageSchema.parse(
          await hub.search({
            kind: KnowledgeKind.Persona,
            mode: KnowledgeSearchMode.Words,
            question: PersonaRegister.Judge,
          }),
        );
        assert.equal(matches.results.find((match) => match.title === reference)?.persona?.runs, 1);
      }
      const before = (await hub.get(personaEntryId(reference))).entry;
      await hub.recordPersonaHistory(run, new RunStore(run.root).events());
      await hub.recordPersonaHistory(run, new RunStore(run.root).events());
      assert.deepEqual((await hub.get(before.id)).entry, before);
      const judged = [];
      for await (const event of new RunStore(run.root).events()) {
        if (event.type === RunEventKind.ResultJudged) judged.push(event);
      }
      assert.equal(judged.length, interrupted ? 0 : 3);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function personaLaterCheck(
  first: boolean,
  later: boolean,
  script: boolean,
  cli = Packaging.CliSource,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const base = workflow();
    assert(base.steps?.[0]);
    const plan = WorkflowSchema.parse({
      ...base,
      backends: {
        fake: {
          script: {
            version: FakeScriptLimit.Version,
            answers: [
              {
                persona: PersonaRegister.Judge,
                task: PersonaRegister.Task,
                answer: { note: PersonaRegister.Note },
              },
              {
                persona: PersonaRegister.Checker,
                task: PersonaRegister.Check,
                answer: {
                  verdict: first ? Verdict.Refuted : Verdict.Survived,
                  evidence: PersonaRegister.Evidence,
                },
              },
              {
                persona: PersonaRegister.Skeptic,
                task: PersonaRegister.Check,
                answer: {
                  verdict: later ? Verdict.Refuted : Verdict.Survived,
                  evidence: PersonaRegister.Evidence,
                },
              },
            ],
          },
        },
      },
      personas: {
        ...base.personas,
        [PersonaRegister.Skeptic]: {
          description: PersonaRegister.CheckerDescription,
          role: PersonaRegister.RoleSecond,
        },
      },
      steps: [
        {
          ...base.steps[0],
          falsify: [
            { persona: PersonaRegister.Checker, task: PersonaRegister.Check },
            script
              ? { script: later ? "false" : "true" }
              : { persona: PersonaRegister.Skeptic, task: PersonaRegister.Check },
          ],
        },
      ],
    });
    let executions = 0;
    const backend = () =>
      new FakeBackend(async (spec) => {
        executions++;
        if (spec.persona_id === PersonaRegister.Judge)
          return { json: { note: PersonaRegister.Note } };
        return {
          json: {
            verdict: (spec.persona_id === PersonaRegister.Checker ? first : later)
              ? Verdict.Refuted
              : Verdict.Survived,
            evidence: PersonaRegister.Evidence,
          },
        };
      });
    const body = {
      project: home,
      workflow: plan,
      backend: Backend.Fake,
      client_id: PersonaRegister.Judge,
      submission_id: PersonaRegister.StepId,
    };
    if (script) await personaScriptQuality(plan, backend, first, later);
    const childServer = script || cli !== Packaging.CliSource;
    const server = await openServer(home, backend, childServer ? cli : undefined);
    const client = createRunClient(home);
    let run: Run;
    try {
      run = RunSchema.parse(await client.submit(body));
      if (script) {
        const requests = createRequestClient(home);
        assert.ok(
          await waitUntil(
            async () => (await requests.list({ run_id: run.run_id })).requests.length === 1,
          ),
        );
        const pending = (await requests.list({ run_id: run.run_id })).requests[0]?.request;
        assert(pending);
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: pending.request_id,
            version: pending.version,
            decision: RequestDecision.Approve,
            reason: PersonaRegister.Evidence,
            client_id: PersonaRegister.Judge,
          },
          ApprovalLevel.Human,
        );
      }
      const expected = first || later ? RunStatus.Failed : RunStatus.Passed;
      assert.ok(
        await waitUntil(async () => (await client.get(run.run_id)).state === expected),
        JSON.stringify({
          run: await client.get(run.run_id),
          events: await client.events(run.run_id),
        }),
      );
    } finally {
      await server.stop();
    }
    const restarted = await openServer(home, backend, childServer ? cli : undefined);
    try {
      run = RunSchema.parse(await createRunClient(home).submit(body));
    } finally {
      await restarted.stop();
    }
    const hub = await KnowledgeHub.open(home);
    try {
      const reference = `${PersonaRegister.Checker}@1`;
      const before = (await hub.get(personaEntryId(reference))).entry;
      const checker = await record(hub, reference);
      assert.equal(checker.uses, 1);
      assert.equal(checker.falsifier_refutations, Number(first));
      assert.equal(checker.falsifier_passes_later_refuted, Number(!first && later));
      assert.equal(checker.history?.[0]?.later_refuted, !first && later ? true : undefined);
      await hub.recordPersonaHistory(run, new RunStore(run.root).events());
      assert.deepEqual((await hub.get(before.id)).entry, before);
      const shown = PersonaInspectionSchema.parse(
        await runCliCommand(cli, home, ["persona", "show", reference]),
      ).versions[0];
      assert.equal(shown?.falsifier_passes_later_refuted, Number(!first && later));
      assert.equal(executions, script ? 2 : childServer ? 0 : 3);
      return true;
    } finally {
      await hub.close();
    }
  });
}

async function personaScriptQuality(
  workflow: Workflow,
  backend: BackendFactory,
  first: boolean,
  later: boolean,
): Promise<void> {
  await withTemporaryDirectory(async (project) => {
    const home = resolve(project, PersonaRegister.Strays);
    const hub = await KnowledgeHub.open(home);
    try {
      const references = await hub.registerPersonas(workflow);
      const engine = new Engine(
        backend,
        {},
        {
          runtimePaths: [home],
          scripts: async () => ({
            exit_code: Number(later),
            stdout: Buffer.alloc(0),
            stderr: Buffer.alloc(0),
          }),
          personaHistory: (run, events) => hub.recordPersonaHistory(run, events),
        },
      );
      const run = await engine.create({
        project,
        plan: validateWorkflow(workflow),
        persona_references: references,
        config: await resolveConfig({ home, project }),
        backend: Backend.Fake,
        client_id: PersonaRegister.Judge,
        submission_id: PersonaRegister.StepId,
      });
      await engine.start(run.run_id);
      assert.equal(run.state, first || later ? RunStatus.Failed : RunStatus.Passed);
      const checker = await record(hub, `${PersonaRegister.Checker}@1`);
      assert.equal(checker.falsifier_passes_later_refuted, Number(!first && later));
    } finally {
      await hub.close();
    }
  });
}

export async function personaHistoryRecovery(
  interrupted: boolean,
  index: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const run = await completed(root, true, false, false);
    const home = resolve(root, PersonaRegister.Strays);
    let armed = false;
    let failed = false;
    const hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (
        armed &&
        interrupted &&
        !failed &&
        stage === (index ? KnowledgePublicationStage.Index : KnowledgePublicationStage.Journal)
      ) {
        failed = true;
        throw new Error(PersonaRegister.Broken);
      }
    });
    try {
      await hub.registerPersonas(workflow());
      armed = true;
      const write = () => hub.recordPersonaHistory(run, new RunStore(run.root).events());
      if (interrupted) await assert.rejects(write());
      else await write();
    } finally {
      await hub.close();
    }
    const recovered = await KnowledgeHub.open(home);
    try {
      await recovered.recordPersonaHistory(run, new RunStore(run.root).events());
      await recovered.recordPersonaHistory(run, new RunStore(run.root).events());
      const worker = await record(recovered, PersonaRegister.JudgeFirst);
      assert.equal(worker.survived, 2);
      assert.equal(worker.refuted, 1);
      assert.equal(worker.history?.length, 3);
      assert.equal(
        (await record(recovered, `${PersonaRegister.Checker}@1`)).falsifier_refutations,
        1,
      );
      assert.equal(failed, interrupted);
      return true;
    } finally {
      await recovered.close();
    }
  });
}

export async function personaLegacyQuality(history: boolean, replay: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const run = await completed(root, true, false, false);
    const hub = await KnowledgeHub.open(resolve(root, PersonaRegister.Strays));
    try {
      await hub.registerPersonas(workflow());
      for (const reference of [PersonaRegister.JudgeFirst, `${PersonaRegister.Checker}@1`]) {
        const { entry } = await hub.get(personaEntryId(reference));
        const body = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
        if (!history) delete body.history;
        await hub.update({
          id: entry.id,
          version: entry.version,
          entry: {
            kind: entry.kind,
            title: entry.title,
            tags: entry.tags,
            body: Bun.YAML.stringify({
              ...body,
              survived: 8,
              refuted: 2,
              runs: 4,
              falsifier_refutations: 3,
            }),
          },
        });
      }
      await hub.recordPersonaHistory(run, new RunStore(run.root).events());
      const before = (await hub.get(personaEntryId(PersonaRegister.JudgeFirst))).entry;
      if (replay) await hub.recordPersonaHistory(run, new RunStore(run.root).events());
      const worker = await record(hub, PersonaRegister.JudgeFirst);
      const checker = await record(hub, `${PersonaRegister.Checker}@1`);
      assert.equal(worker.survived, 10);
      assert.equal(worker.refuted, 3);
      assert.equal(worker.runs, 5);
      assert.equal(worker.falsifier_refutations, 3);
      assert.equal(checker.survived, 8);
      assert.equal(checker.refuted, 2);
      assert.equal(checker.runs, 5);
      assert.equal(checker.falsifier_refutations, 4);
      assert.deepEqual((await hub.get(before.id)).entry, before);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function personaHistoryWithoutTotals(
  refuted: boolean,
  replay: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    await completed(root, refuted, false, false);
    const next = await completed(resolve(root, PersonaRegister.Strays), refuted, false, false);
    const hub = await KnowledgeHub.open(root);
    try {
      for (const reference of [PersonaRegister.JudgeFirst, `${PersonaRegister.Checker}@1`]) {
        const { entry } = await hub.get(personaEntryId(reference));
        const body = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
        delete body.survived;
        delete body.refuted;
        delete body.runs;
        delete body.falsifier_refutations;
        delete body.falsifier_passes_later_refuted;
        delete body.uses;
        delete body.usage;
        delete body.sampling;
        await hub.update({
          id: entry.id,
          version: entry.version,
          entry: {
            kind: entry.kind,
            title: entry.title,
            tags: entry.tags,
            body: Bun.YAML.stringify(body),
          },
        });
        const inspected = await inspectPersona(root, { selector: reference });
        const measured = inspected.versions[0];
        assert.ok(measured);
        assert.equal(measured.usage?.history_complete, false);
        assert.deepEqual(measured.usage?.reports, []);
        assert.deepEqual(measured.usage?.complete, {
          input_tokens: false,
          output_tokens: false,
          cost_usd: false,
        });
        assert.deepEqual(
          PersonaRecordSchema.parse(
            Bun.YAML.parse((await hub.get(personaEntryId(reference))).entry.body),
          ),
          body,
        );
        const workers = body.history?.filter((result) => result.role === NativeToolRole.Worker);
        assert.equal(measured.uses, body.history?.length);
        assert.equal(
          measured.survived,
          workers?.filter((result) => result.verdict === Verdict.Survived).length,
        );
        assert.equal(
          measured.refuted,
          workers?.filter((result) => result.verdict === Verdict.Refuted).length,
        );
      }
      await hub.recordPersonaHistory(next, new RunStore(next.root).events());
      const before = (await hub.get(personaEntryId(PersonaRegister.JudgeFirst))).entry;
      if (replay) await hub.recordPersonaHistory(next, new RunStore(next.root).events());
      const worker = await record(hub, PersonaRegister.JudgeFirst);
      const checker = await record(hub, `${PersonaRegister.Checker}@1`);
      assert.equal(worker.survived, refuted ? 4 : 6);
      assert.equal(worker.refuted, refuted ? 2 : 0);
      assert.equal(worker.runs, 2);
      assert.equal(worker.history?.length, 6);
      assert.equal(checker.falsifier_refutations, refuted ? 2 : 0);
      assert.equal(checker.runs, 2);
      assert.deepEqual((await hub.get(before.id)).entry, before);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function personaProductionSplitHistory(
  refuted: boolean,
  interrupted: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const run = await completed(home, refuted, interrupted, refuted, true);
    const hub = await KnowledgeHub.open(home);
    try {
      const worker = await record(hub, PersonaRegister.JudgeFirst);
      const checker = await record(hub, `${PersonaRegister.Checker}@1`);
      assert.equal(worker.history?.length, interrupted ? 0 : 3);
      assert.equal(checker.history?.length, interrupted ? 0 : 2);
      if (!interrupted) {
        const parts = worker.history?.filter((result) =>
          result.part.startsWith(ExecutionPhase.PartPrefix),
        );
        assert.deepEqual(parts?.map((part) => part.part).sort(), ["part-0", "part-1"]);
        assert.equal(new Set(parts?.map((part) => part.candidate)).size, 1);
        assert.equal(worker.survived, refuted ? 1 : 3);
        assert.equal(worker.refuted, refuted ? 2 : 0);
      }
      const before = (await hub.get(personaEntryId(PersonaRegister.JudgeFirst))).entry;
      await hub.recordPersonaHistory(run, new RunStore(run.root).events());
      assert.deepEqual((await hub.get(before.id)).entry, before);
      return true;
    } finally {
      await hub.close();
    }
  });
}

async function* replay(
  run: Run,
  changed: boolean,
  foreign: boolean,
  later: boolean,
): AsyncIterable<RunEvent> {
  for await (const event of new RunStore(run.root).events()) {
    if (event.type !== RunEventKind.ResultJudged) continue;
    const data = PersonaJudgementSchema.parse(event.data);
    const result = later ? data.results[1] : data.results[0];
    assert.ok(result);
    if (changed)
      result.verdict = result.verdict === Verdict.Survived ? Verdict.Refuted : Verdict.Survived;
    if (foreign) result.run = PersonaRegister.Strays;
    if (later) result.later_refuted = true;
    yield { ...event, data };
  }
}

export async function personaHistoryReplay(
  changed: boolean,
  foreign: boolean,
  later = false,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const run = await completed(home, false, false, false);
    const hub = await KnowledgeHub.open(home);
    try {
      const before = (
        await hub.get(
          personaEntryId(later ? `${PersonaRegister.Checker}@1` : PersonaRegister.JudgeFirst),
        )
      ).entry;
      const publish = () => hub.recordPersonaHistory(run, replay(run, changed, foreign, later));
      if (changed || foreign || later)
        await assert.rejects(publish(), { code: ErrorCode.KnowledgeCorrupt });
      else await publish();
      assert.deepEqual((await hub.get(before.id)).entry, before);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function personaTerminalHistoryRecovery(
  refuted: boolean,
  interrupted: boolean,
  index: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (project) => {
    const home = resolve(project, PersonaRegister.Strays);
    let armed = false;
    let failed = false;
    let executions = 0;
    let hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (
        armed &&
        interrupted &&
        !failed &&
        stage === (index ? KnowledgePublicationStage.Index : KnowledgePublicationStage.Journal)
      ) {
        failed = true;
        throw new Error(PersonaRegister.Broken);
      }
    });
    const references = await hub.registerPersonas(workflow());
    const backend = () =>
      new FakeBackend(async (spec) => {
        executions++;
        if (spec.persona_id === PersonaRegister.Judge)
          return { json: { note: PersonaRegister.Note } };
        return {
          json: {
            verdict:
              refuted && spec.invocation_id.startsWith(`${PersonaRegister.StepId}-3/`)
                ? Verdict.Refuted
                : Verdict.Survived,
            evidence: PersonaRegister.Evidence,
          },
        };
      });
    const services = {
      runtimePaths: [home],
      personaHistory: async (run: Run, events: AsyncIterable<RunEvent>) => {
        armed = true;
        await hub.recordPersonaHistory(run, events);
      },
    };
    const engine = new Engine(backend, {}, services);
    const run = await engine.create({
      project,
      plan: validateWorkflow(workflow()),
      persona_references: references,
      config: await resolveConfig({ home, project }),
      backend: Backend.Fake,
      client_id: PersonaRegister.Judge,
      submission_id: PersonaRegister.StepId,
    });
    try {
      await engine.start(run.run_id);
      const intended = refuted ? RunStatus.Failed : RunStatus.Passed;
      assert.equal(run.state, interrupted ? RunStatus.Blocked : intended);
      assert.equal(run.pending_journal?.state, interrupted ? intended : undefined);
      const dispatched = executions;
      await hub.close();
      hub = await KnowledgeHub.open(home);
      const restored = new Engine(backend, {}, services);
      const saved = await restored.load(run.root);
      if (interrupted) await restored.resume(run.run_id);
      assert.equal(saved.state, intended);
      assert.equal(saved.pending_journal, undefined);
      assert.equal(executions, dispatched);
      const worker = await record(hub, PersonaRegister.JudgeFirst);
      assert.equal(worker.history?.length, 3);
      assert.equal(worker.survived, refuted ? 2 : 3);
      assert.equal(worker.refuted, refuted ? 1 : 0);
      return true;
    } finally {
      await hub.close();
    }
  });
}
