import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { RunStore } from "@titan/board";
import {
  Backend,
  KnowledgePublicationStage,
  PersonaRegister,
  PersonaRule,
  PersonaState,
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
  PersonaRecordSchema,
  type Run,
  RunSchema,
  type Workflow,
  WorkflowSchema,
} from "@titan/types";

export function personaSampling(
  refuted: boolean,
  replay = false,
  interrupted = false,
  stage?: KnowledgePublicationStage,
  capacity = false,
) {
  return withTemporaryDirectory(async (home) => {
    const tags = [PersonaRegister.Judge, PersonaRegister.Checker];
    const persona = {
      description: PersonaRegister.Description,
      role: PersonaRegister.RoleFirst,
    };
    const workflow = WorkflowSchema.parse({
      name: PersonaRegister.WorkflowName,
      goal: PersonaRegister.Goal,
      personas: {
        [PersonaRegister.Judge]: { ...persona, tags },
        [PersonaRegister.Skeptic]: { ...persona, tags: [...tags].reverse() },
        [PersonaRegister.Fixer]: { ...persona, tags: [PersonaRegister.Judge] },
        [PersonaRegister.Checker]: {
          ...persona,
          role: PersonaRegister.CheckerRole,
          tags: [PersonaRegister.Checker],
        },
      },
      steps: [
        {
          id: PersonaRegister.StepId,
          do: { persona: PersonaRegister.Judge, task: PersonaRegister.Task },
          falsify: [{ persona: PersonaRegister.Checker, task: PersonaRegister.Check }],
          max_attempts: 1,
        },
      ],
    });
    await seedSampling(home, workflow);
    let waiting = false;
    const server = await startServer(
      home,
      () =>
        new FakeBackend(async (spec, _prompt, signal) => {
          if (spec.persona_id === PersonaRegister.Judge) {
            if (interrupted) {
              waiting = true;
              await new Promise<void>((done) =>
                signal.addEventListener("abort", () => done(), { once: true }),
              );
              signal.throwIfAborted();
            }
            return { json: { note: PersonaRegister.Note } };
          }
          return {
            json: {
              verdict: refuted ? Verdict.Refuted : Verdict.Survived,
              evidence: PersonaRegister.Evidence,
            },
          };
        }),
    );
    await using resources = new AsyncDisposableStack();
    resources.defer(() => server.stop());
    const client = createRunClient(home);
    const submitted = await client.submit({
      project: home,
      workflow,
      backend: Backend.Fake,
      client_id: PersonaRegister.Judge,
      submission_id: PersonaRegister.StepId,
    });
    if (interrupted) {
      assert(await waitUntil(async () => waiting));
      await client.control(submitted.run_id, RunAction.Cancel);
    }
    assert(
      await waitUntil(
        async () =>
          (await client.get(submitted.run_id)).state ===
          (interrupted ? RunStatus.Cancelled : refuted ? RunStatus.Failed : RunStatus.Passed),
      ),
    );
    const run = RunSchema.parse(await client.get(submitted.run_id));
    await server.stop();
    const hub = await KnowledgeHub.open(home);
    try {
      const entries = [];
      for (const name of [PersonaRegister.Judge, PersonaRegister.Skeptic, PersonaRegister.Fixer])
        entries.push((await hub.get(personaEntryId(`${name}@1`))).entry);
      const records = entries.map((entry) => PersonaRecordSchema.parse(Bun.YAML.parse(entry.body)));
      assert.equal(records[0]?.survived, 10 + Number(!interrupted && !refuted));
      assert.equal(records[0]?.refuted, 5 + Number(!interrupted && refuted));
      assert.equal(records[1]?.survived, 3);
      assert.equal(records[1]?.refuted, 2);
      assert.deepEqual(
        records[0]?.sampling,
        interrupted
          ? undefined
          : {
              survived: 10 * PersonaRule.Fade + Number(!refuted),
              refuted: 5 * PersonaRule.Fade + Number(refuted),
            },
      );
      assert.deepEqual(
        records[1]?.sampling,
        interrupted
          ? undefined
          : {
              survived: 3 * PersonaRule.Fade,
              refuted: 2 * PersonaRule.Fade,
            },
      );
      assert.equal(records[2]?.sampling, undefined);
      const picked = await hub.openCall(tags);
      assert(picked);
      const chosen = records.find((record) => record.name === picked.entry.name);
      assert(chosen);
      assert.equal(picked.entry.survived, chosen.sampling?.survived ?? chosen.survived);
      assert.equal(picked.entry.refuted, chosen.sampling?.refuted ?? chosen.refuted);
      if (replay) await hub.recordPersonaHistory(run, new RunStore(run.root).events(run.version));
      for (const entry of entries) assert.deepEqual((await hub.get(entry.id)).entry, entry);
    } finally {
      await hub.close();
    }
    if (stage)
      await recoverSampling(resolve(home, PersonaRegister.Strays), workflow, run, stage, capacity);
    return true;
  });
}

async function seedSampling(home: string, workflow: Workflow): Promise<void> {
  const hub = await KnowledgeHub.open(home);
  try {
    await hub.registerPersonas(workflow);
    for (const [name, survived, refuted] of [
      [PersonaRegister.Judge, 10, 5],
      [PersonaRegister.Skeptic, 3, 2],
      [PersonaRegister.Fixer, 7, 1],
    ] as const) {
      const { entry } = await hub.get(personaEntryId(`${name}@1`));
      const body = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
      const { id, version, ...draft } = entry;
      await hub.update({
        id,
        version,
        entry: {
          ...draft,
          body: Bun.YAML.stringify({ ...body, survived, refuted, state: PersonaState.Trial }),
        },
      });
    }
  } finally {
    await hub.close();
  }
}

async function recoverSampling(
  home: string,
  workflow: Workflow,
  run: Run,
  stage: KnowledgePublicationStage,
  capacity: boolean,
): Promise<void> {
  await seedSampling(home, workflow);
  let failed = false;
  const settings = capacity
    ? stage === KnowledgePublicationStage.Journal
      ? { max_publication_entries: 1 }
      : { max_publication_bytes: 1 }
    : {};
  const hub = await KnowledgeHub.open(home, settings, async (observed) => {
    if (!capacity && observed === stage && !failed) {
      failed = true;
      throw new Error(PersonaRegister.Broken);
    }
  });
  const before = [];
  try {
    for (const name of [PersonaRegister.Judge, PersonaRegister.Skeptic])
      before.push((await hub.get(personaEntryId(`${name}@1`))).entry);
    await assert.rejects(hub.recordPersonaHistory(run, new RunStore(run.root).events(run.version)));
    assert.equal(failed, !capacity);
    if (capacity)
      for (const entry of before) assert.deepEqual((await hub.get(entry.id)).entry, entry);
  } finally {
    await hub.close();
  }
  const recovered = await KnowledgeHub.open(home);
  try {
    await recovered.recordPersonaHistory(run, new RunStore(run.root).events(run.version));
    const saved = [];
    for (const entry of before) {
      const current = (await recovered.get(entry.id)).entry;
      const record = PersonaRecordSchema.parse(Bun.YAML.parse(current.body));
      const previous = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
      assert.equal(current.version, entry.version + 1);
      assert.deepEqual(record.sampling, {
        survived:
          (previous.survived ?? 0) * PersonaRule.Fade +
          Number(record.name === PersonaRegister.Judge),
        refuted: (previous.refuted ?? 0) * PersonaRule.Fade,
      });
      saved.push(current);
    }
    await recovered.recordPersonaHistory(run, new RunStore(run.root).events(run.version));
    for (const entry of saved) assert.deepEqual((await recovered.get(entry.id)).entry, entry);
  } finally {
    await recovered.close();
  }
}
