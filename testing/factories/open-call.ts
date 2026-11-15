import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { boardPersonaPicks, RunStore } from "@titan/board";
import { resolveConfig } from "@titan/config";
import {
  Backend,
  ErrorCode,
  FakeScriptLimit,
  HiveFixture,
  KnowledgeKind,
  OpenCallFixture,
  OpenCallTamper,
  PersonaRule,
  PersonaState,
  RequestKind,
  RunAction,
  RunStatus,
  StepStatus,
  Verdict,
} from "@titan/constants";
import { KnowledgeHub, openCallResolver, personaEntryId } from "@titan/knowledge";
import { Engine, runWorkflow } from "@titan/runner";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  AgentSpecSchema,
  type BackendId,
  PersonaRecordSchema,
  type PersonaRegisterEntry,
  PersonaRegisterEntrySchema,
  PersonaSchema,
  type Random,
  type Run,
  RunSchema,
  WorkflowSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { openServer } from "./server-run-hub.ts";

function sequence(): Random {
  let state: number = OpenCallFixture.Seed;
  return () => {
    state = (state * OpenCallFixture.Multiplier) % OpenCallFixture.Modulus;
    return state / OpenCallFixture.Modulus;
  };
}

function register(personaTags: readonly string[], state: string): PersonaRegisterEntry[] {
  if (state === OpenCallFixture.Empty) return [];
  const base = vendorRecoveryWorkflow(HiveFixture.CheckTask).personas.worker;
  return [
    PersonaRegisterEntrySchema.parse({
      name: OpenCallFixture.Chemist,
      version: OpenCallFixture.Version,
      state,
      survived: OpenCallFixture.Survived,
      refuted: OpenCallFixture.Refuted,
      persona: PersonaSchema.parse({ ...base, tags: personaTags }),
    }),
  ];
}

async function launchCall(
  root: string,
  callTags: readonly string[],
  personaTags: readonly string[],
  state: string,
) {
  const config = await resolveConfig({ home: resolve(root, "home"), project: root });
  const ran: string[] = [];
  const backend = new FakeBackend(async (spec) => {
    if (spec.persona_id === HiveFixture.Checker)
      return { json: { verdict: Verdict.Survived, evidence: HiveFixture.Evidence } };
    if (spec.persona_id) ran.push(spec.persona_id);
    return {
      json: { ok: true, marker: OpenCallFixture.Marker, turn: OpenCallFixture.Turn },
    };
  });
  const entries = register(personaTags, state);
  const engine = new Engine(
    () => backend,
    {},
    {
      openCalls: openCallResolver(async () => entries, sequence()),
    },
  );
  const base = vendorRecoveryWorkflow(HiveFixture.CheckTask);
  const run = await engine.create({
    project: root,
    config,
    plan: validateWorkflow({
      ...base,
      steps: [
        {
          id: OpenCallFixture.StepId,
          do: { call: { tags: [...callTags], task: OpenCallFixture.Task } },
          falsify: [{ persona: HiveFixture.Checker, task: HiveFixture.CheckTask }],
        },
      ],
    }),
    backend: Backend.Fake,
    client_id: OpenCallFixture.ClientId,
    submission_id: OpenCallFixture.ClientId,
  });
  await engine.start(run.run_id);
  return { engine, run, ran };
}

async function observeCall(
  root: string,
  callTags: readonly string[],
  personaTags: readonly string[],
  state: string,
  resumes: number,
): Promise<string> {
  const { engine, run, ran } = await launchCall(root, callTags, personaTags, state);
  for (let turn = 0; turn < resumes; turn++) await engine.resume(run.run_id);
  const picks = await boardPersonaPicks(new RunStore(run.root).events());
  const requests = (await engine.requests.list(run.run_id))
    .filter((request) => request.kind === RequestKind.NewPersona)
    .map((request) =>
      [request.scope.resource, request.scope.arguments[0]].join(OpenCallFixture.PickJoin),
    );
  return [
    run.nodes[OpenCallFixture.StepId]?.state,
    ran.join(OpenCallFixture.ListJoin),
    picks
      .map((line) => [line.persona, line.rule].join(OpenCallFixture.PickJoin))
      .join(OpenCallFixture.ListJoin),
    requests.join(OpenCallFixture.ListJoin),
  ].join(OpenCallFixture.Join);
}

export async function openCallScenario(
  callTags: string[],
  personaTags: string[],
  state: string,
): Promise<string> {
  return withTemporaryDirectory((root) => observeCall(root, callTags, personaTags, state, 0));
}

function tamper(run: Run, kind: string): void {
  const step = run.plan.nodes[0];
  const persona = run.picks?.[OpenCallFixture.StepId];
  assert.ok(step && persona);
  if (kind === OpenCallTamper.UnknownStep)
    run.picks = { ...run.picks, [OpenCallTamper.Ghost]: persona };
  if (kind === OpenCallTamper.OtherPersona)
    run.picks = { [OpenCallFixture.StepId]: OpenCallTamper.Ghost };
  if (kind === OpenCallTamper.OtherTask) step.do = { persona, task: OpenCallTamper.Ghost };
  if (kind === OpenCallTamper.GhostPersona) {
    run.picks = { [OpenCallFixture.StepId]: OpenCallTamper.Ghost };
    step.do = { persona: OpenCallTamper.Ghost, task: OpenCallFixture.Task };
  }
}

export async function openCallTamper(kind: string): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const { run } = await launchCall(
      root,
      [OpenCallFixture.Chemistry],
      [OpenCallFixture.Chemistry],
      OpenCallTamper.State,
    );
    const store = new RunStore(run.root);
    const state = await store.read();
    tamper(state, kind);
    await store.commit(state, OpenCallTamper.Event);
    return OpenCallTamper.Ok;
  });
}

export async function openCallResume(
  callTags: string[],
  personaTags: string[],
  state: string,
  resumes: number,
): Promise<string> {
  return withTemporaryDirectory((root) => observeCall(root, callTags, personaTags, state, resumes));
}

async function seedCall(home: string, state: PersonaState, fault: boolean, versions = 1) {
  const base = vendorRecoveryWorkflow(HiveFixture.CheckTask);
  const hub = await KnowledgeHub.open(home);
  try {
    for (let version = 1; version <= versions; version++) {
      await hub.registerPersonas(
        WorkflowSchema.parse({
          ...base,
          personas: {
            ...base.personas,
            [OpenCallFixture.Chemist]: {
              ...PersonaSchema.parse(base.personas.worker),
              tags: [OpenCallFixture.Chemistry],
              ...(version > 1 ? { role: OpenCallFixture.Role } : {}),
              ...(fault ? { backend: Backend.Claude } : {}),
            },
          },
        }),
      );
      const { entry } = await hub.get(personaEntryId(`${OpenCallFixture.Chemist}@${version}`));
      const body = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
      await hub.update({
        id: entry.id,
        version: entry.version,
        entry: {
          kind: entry.kind,
          title: entry.title,
          tags: entry.tags,
          body: Bun.YAML.stringify({
            ...body,
            state: version > 1 && state === PersonaState.NeedsUpdate ? PersonaState.Trial : state,
          }),
        },
      });
    }
    await hub.add({
      kind: KnowledgeKind.Fact,
      title: OpenCallFixture.Task,
      body: OpenCallFixture.Marker,
    });
    await hub.add({
      kind: KnowledgeKind.Persona,
      title: OpenCallFixture.Lawyer,
      body: OpenCallFixture.Marker,
    });
  } finally {
    await hub.close();
  }
}

export function registeredOpenCallDocument(
  malformed: boolean,
  canonical: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    await seedCall(home, PersonaState.Trial, false);
    const hub = await KnowledgeHub.open(home);
    try {
      await hub.add({
        ...(canonical ? { id: personaEntryId("broken@1") } : {}),
        kind: KnowledgeKind.Persona,
        title: canonical ? "broken@1" : "Persona notes",
        body: malformed
          ? "persona: ["
          : Bun.YAML.stringify({
              name: "reference",
              version: 1,
              persona: canonical
                ? {}
                : PersonaSchema.parse(
                    vendorRecoveryWorkflow(HiveFixture.CheckTask).personas.worker,
                  ),
            }),
      });
      if (canonical)
        await assert.rejects(hub.openCall([OpenCallFixture.Chemistry]), {
          code: ErrorCode.KnowledgeCorrupt,
        });
      else
        assert.equal(
          (await hub.openCall([OpenCallFixture.Chemistry]))?.entry.name,
          OpenCallFixture.Chemist,
        );
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function programOpenCall(state: PersonaState, matching: boolean): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    await seedCall(home, state, false, 2);
    const base = vendorRecoveryWorkflow(HiveFixture.CheckTask);
    const path = resolve(root, "workflow.yaml");
    await writeFile(
      path,
      Bun.YAML.stringify({
        ...base,
        steps: [
          {
            id: OpenCallFixture.StepId,
            do: {
              call: {
                tags: [matching ? OpenCallFixture.Chemistry : OpenCallFixture.TaxLaw],
                task: OpenCallFixture.Task,
              },
            },
            falsify: [{ persona: HiveFixture.Checker, task: HiveFixture.CheckTask }],
          },
        ],
      }),
    );
    const handle = await runWorkflow(
      path,
      {
        home,
        project,
        default_backend: Backend.Fake,
        client_id: OpenCallFixture.ClientId,
        submission_id: OpenCallFixture.StepId,
      },
      () =>
        new FakeBackend(async (spec) => {
          AgentSpecSchema.parse(spec);
          return spec.persona_id === HiveFixture.Checker
            ? { json: { verdict: Verdict.Survived, evidence: HiveFixture.Evidence } }
            : { json: { ok: true, marker: OpenCallFixture.Marker, turn: OpenCallFixture.Turn } };
        }),
    );
    const run = await handle.done;
    const eligible = matching && PersonaRule.Callable.some((value) => value === state);
    assert.equal(run.state, eligible ? RunStatus.Passed : RunStatus.Waiting);
    const picks = await boardPersonaPicks(new RunStore(run.root).events());
    assert.equal(picks.length, eligible ? 1 : 0);
    if (eligible) {
      const versions = [`${OpenCallFixture.Chemist}@1`, `${OpenCallFixture.Chemist}@2`];
      assert.deepEqual(picks[0]?.eligible, versions);
      assert(versions.includes(picks[0]?.persona ?? OpenCallFixture.Empty));
      assert(Number.isSafeInteger(picks[0]?.seed));
    }
    return true;
  });
}

export async function serverOpenCall(
  state: PersonaState,
  matching: boolean,
  restart: boolean,
  fault = false,
  cli?: string,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    await seedCall(home, state, fault);
    const base = vendorRecoveryWorkflow(HiveFixture.CheckTask);
    const dispatched: string[] = [];
    const factory = (backend: BackendId) => {
      if (fault && backend === Backend.Claude) throw new Error(OpenCallFixture.Task);
      return new FakeBackend(async (spec) => {
        AgentSpecSchema.parse(spec);
        assert(spec.persona_id);
        dispatched.push(spec.persona_id);
        return spec.persona_id === HiveFixture.Checker
          ? { json: { verdict: Verdict.Survived, evidence: HiveFixture.Evidence } }
          : { json: { ok: true, marker: OpenCallFixture.Marker, turn: OpenCallFixture.Turn } };
      });
    };
    const body = {
      project: home,
      workflow: {
        ...base,
        ...(cli
          ? {
              backends: {
                fake: {
                  script: {
                    version: FakeScriptLimit.Version,
                    answers: [
                      {
                        persona: `${OpenCallFixture.Chemist}@1`,
                        task: OpenCallFixture.Task,
                        answer: {
                          ok: true,
                          marker: OpenCallFixture.Marker,
                          turn: OpenCallFixture.Turn,
                        },
                      },
                      {
                        persona: HiveFixture.Checker,
                        task: HiveFixture.CheckTask,
                        answer: { verdict: Verdict.Survived, evidence: HiveFixture.Evidence },
                      },
                    ],
                  },
                },
              },
            }
          : {}),
        steps: [
          ...(fault ? base.steps : []),
          {
            id: OpenCallFixture.StepId,
            do: {
              call: {
                tags: [matching ? OpenCallFixture.Chemistry : OpenCallFixture.TaxLaw],
                task: OpenCallFixture.Task,
              },
            },
            falsify: [{ persona: HiveFixture.Checker, task: HiveFixture.CheckTask }],
          },
        ],
      },
      backend: Backend.Fake,
      client_id: OpenCallFixture.ClientId,
      submission_id: OpenCallFixture.StepId,
    };
    let server = await openServer(home, factory, cli);
    await using resources = new AsyncDisposableStack();
    resources.defer(() => server.stop());
    const client = createRunClient(home);
    const started = await client.submit(body);
    const eligible = matching && PersonaRule.Callable.some((value) => value === state);
    const successful = eligible && !fault;
    const expected = fault ? RunStatus.Blocked : successful ? RunStatus.Passed : RunStatus.Waiting;
    assert(await waitUntil(async () => (await client.get(started.run_id)).state === expected));
    if (restart) {
      await server.stop();
      server = await openServer(home, factory, cli);
      assert.equal((await client.submit(body)).run_id, started.run_id);
    }
    if (!eligible) await client.control(started.run_id, RunAction.Resume);
    assert(await waitUntil(async () => (await client.get(started.run_id)).state === expected));
    const run = RunSchema.parse(await client.get(started.run_id));
    assert.equal(run.state, expected);
    const picks = await boardPersonaPicks(new RunStore(run.root).events());
    const requests = (await createRequestClient(home).list({ run_id: run.run_id })).requests;
    assert.equal(requests.length, eligible ? 0 : 1);
    if (!cli) assert.equal(dispatched.length, successful || fault ? 2 : 0);
    if (successful) {
      const picked = picks[0];
      assert(picked);
      assert.equal(picks.length, 1);
      assert.equal(picked.persona, `${OpenCallFixture.Chemist}@1`);
      assert.deepEqual(picked.eligible, [`${OpenCallFixture.Chemist}@1`]);
      assert(Number.isSafeInteger(picked.seed));
      assert.equal(run.picks?.[OpenCallFixture.StepId], picked.persona);
    } else if (!eligible) assert.equal(requests[0]?.request.kind, RequestKind.NewPersona);
    if (fault) {
      assert.equal(picks.length, 0);
      assert.equal(run.nodes.deliver?.state, StepStatus.Passed);
      assert.equal(run.nodes[OpenCallFixture.StepId]?.state, StepStatus.Blocked);
    }
    await server.stop();
    if (successful) {
      const hub = await KnowledgeHub.open(home);
      try {
        const { entry } = await hub.get(personaEntryId(`${OpenCallFixture.Chemist}@1`));
        const record = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
        assert.equal(record.survived, 1);
        assert.equal(record.history?.length, 1);
      } finally {
        await hub.close();
      }
    }
    return true;
  });
}

export async function serverOpenCallProcess(
  state: PersonaState,
  matching: boolean,
  restart: boolean,
  cli = resolve("apps/cli/src/main.ts"),
) {
  return serverOpenCall(state, matching, restart, false, cli);
}

export function openCallIndependentChecker(alternative: boolean, restart: boolean, cli?: string) {
  return withTemporaryDirectory(async (home) => {
    await seedCall(home, PersonaState.Trial, false, alternative ? 2 : 1);
    let calls = 0;
    const factory = () =>
      new FakeBackend(async (spec) => {
        calls++;
        return spec.persona_id === HiveFixture.Checker
          ? { json: { verdict: Verdict.Survived, evidence: HiveFixture.Evidence } }
          : { json: { ok: true, marker: OpenCallFixture.Marker, turn: OpenCallFixture.Turn } };
      });
    const base = vendorRecoveryWorkflow(HiveFixture.CheckTask);
    const body = {
      project: home,
      workflow: {
        ...base,
        ...(cli
          ? {
              backends: {
                fake: {
                  script: {
                    version: FakeScriptLimit.Version,
                    answers: [
                      {
                        persona: `${OpenCallFixture.Chemist}@2`,
                        task: OpenCallFixture.Task,
                        answer: {
                          ok: true,
                          marker: OpenCallFixture.Marker,
                          turn: OpenCallFixture.Turn,
                        },
                      },
                      {
                        persona: HiveFixture.Checker,
                        task: HiveFixture.CheckTask,
                        answer: { verdict: Verdict.Survived, evidence: HiveFixture.Evidence },
                      },
                    ],
                  },
                },
              },
            }
          : {}),
        personas: {
          ...base.personas,
          [HiveFixture.Checker]: { use: `${OpenCallFixture.Chemist}@1` },
        },
        steps: [
          {
            id: OpenCallFixture.StepId,
            do: { call: { tags: [OpenCallFixture.Chemistry], task: OpenCallFixture.Task } },
            falsify: [{ persona: HiveFixture.Checker, task: HiveFixture.CheckTask }],
          },
        ],
      },
      backend: Backend.Fake,
      client_id: OpenCallFixture.ClientId,
      submission_id: OpenCallFixture.StepId,
    };
    let server = await openServer(home, factory, cli);
    await using resources = new AsyncDisposableStack();
    resources.defer(() => server.stop());
    const client = createRunClient(home);
    const submitted = await client.submit(body);
    const expected = alternative ? RunStatus.Passed : RunStatus.Waiting;
    assert(await waitUntil(async () => (await client.get(submitted.run_id)).state === expected));
    if (restart) {
      await server.stop();
      server = await openServer(home, factory, cli);
      assert.equal((await client.submit(body)).run_id, submitted.run_id);
    }
    if (!alternative) {
      await client.control(submitted.run_id, RunAction.Resume);
      assert(await waitUntil(async () => (await client.get(submitted.run_id)).state === expected));
    }
    const run = RunSchema.parse(await client.get(submitted.run_id));
    const picks = await boardPersonaPicks(new RunStore(run.root).events());
    if (!cli) assert.equal(calls, alternative ? 2 : 0);
    assert.equal((await client.usage(run.run_id)).executions, alternative ? 2 : 0);
    assert.equal(picks.length, Number(alternative));
    if (alternative) {
      assert.equal(picks[0]?.persona, `${OpenCallFixture.Chemist}@2`);
      assert.deepEqual(picks[0]?.eligible, [`${OpenCallFixture.Chemist}@2`]);
    } else {
      const requests = (await createRequestClient(home).list({ run_id: run.run_id })).requests;
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.request.kind, RequestKind.NewPersona);
    }
    return true;
  });
}

export function openCallResolverBoundary(forbidden: boolean, restart: boolean) {
  return withTemporaryDirectory(async (root) => {
    const checker = `${OpenCallFixture.Chemist}@1`;
    const base = vendorRecoveryWorkflow(HiveFixture.CheckTask);
    const entry = register([OpenCallFixture.Chemistry], PersonaState.Trial)[0];
    assert(entry);
    const chosen = { ...entry, version: forbidden ? 1 : 2 };
    let calls = 0;
    const factory = () =>
      new FakeBackend(async (spec) => {
        calls++;
        return spec.persona_id === checker
          ? { json: { verdict: Verdict.Survived, evidence: HiveFixture.Evidence } }
          : { json: { ok: true, marker: OpenCallFixture.Marker, turn: OpenCallFixture.Turn } };
      });
    const services = {
      openCalls: async (_tags: readonly string[], excluded?: readonly string[]) => {
        assert.deepEqual(excluded, [checker]);
        return { entry: chosen, rule: PersonaRule.PickRule };
      },
    };
    let engine = new Engine(factory, {}, services);
    const run = await engine.create({
      project: root,
      config: await resolveConfig({ home: resolve(root, "home"), project: root }),
      backend: Backend.Fake,
      client_id: OpenCallFixture.ClientId,
      submission_id: OpenCallFixture.StepId,
      plan: validateWorkflow({
        ...base,
        personas: { [checker]: base.personas.checker },
        steps: [
          {
            id: OpenCallFixture.StepId,
            do: { call: { tags: [OpenCallFixture.Chemistry], task: OpenCallFixture.Task } },
            falsify: [{ persona: checker, task: HiveFixture.CheckTask }],
          },
        ],
      }),
    });
    await engine.start(run.run_id);
    const expected = forbidden ? RunStatus.Blocked : RunStatus.Passed;
    assert.equal(engine.get(run.run_id).state, expected);
    assert.equal(calls, forbidden ? 0 : 2);
    if (restart) {
      engine = new Engine(factory, {}, services);
      await engine.load(run.root);
      if (forbidden) await engine.resume(run.run_id);
      assert.equal(engine.get(run.run_id).state, expected);
      assert.equal(calls, forbidden ? 0 : 2);
    }
    assert.equal(
      engine.get(run.run_id).picks?.[OpenCallFixture.StepId],
      forbidden ? undefined : `${OpenCallFixture.Chemist}@2`,
    );
    return true;
  });
}

export function openCallIndependentCheckerProcess(
  alternative: boolean,
  restart: boolean,
  cli = resolve("apps/cli/src/main.ts"),
) {
  return openCallIndependentChecker(alternative, restart, cli);
}

export async function openCallLargeRegister(state: PersonaState, excludeChecker: boolean) {
  const base = register([OpenCallFixture.Chemistry], state)[0];
  assert.ok(base);
  const entries = Array.from({ length: 20 }, (_, index) => ({ ...base, version: index + 1 }));
  const excluded = excludeChecker ? [`${base.name}@1`] : [];
  const callable = state === PersonaState.Trial || state === PersonaState.Proven;
  const expected = callable
    ? entries
        .map((entry) => `${entry.name}@${entry.version}`)
        .filter((reference) => !excluded.includes(reference))
        .sort((left, right) => left.localeCompare(right))
    : [];
  const chosen = new Set<string>();
  for (let index = 0; index < Math.max(expected.length, 1); index++) {
    let draws = 0;
    const random = () => {
      draws++;
      assert.ok(draws <= 2);
      return draws === 1 ? 0.999 : (index + 0.5) / expected.length;
    };
    const pick = await openCallResolver(
      async () => entries,
      random,
      42,
    )([OpenCallFixture.Chemistry], excluded);
    if (pick) {
      assert.deepEqual(pick.eligible, expected);
      assert.equal(pick.rule, PersonaRule.PickRule);
      assert.equal(pick.seed, 42);
      chosen.add(`${pick.entry.name}@${pick.entry.version}`);
    }
    assert.equal(draws, expected.length ? 2 : 1);
  }
  assert.deepEqual([...chosen], expected);
  return true;
}
