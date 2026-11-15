import { strict as assert } from "node:assert";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  AgentTool,
  Backend,
  CliOption,
  ConfigFile,
  EnvVar,
  ErrorCode,
  ExitCode,
  FileEncoding,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  KnowledgePublicationStage,
  Packaging,
  PersonaHomeSource,
  PersonaRegister,
  PersonaRule,
  PersonaState,
  RunFile,
  RunFormat,
  RunStatus,
  Verdict,
} from "@titan/constants";
import { all, hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import {
  KnowledgeHub,
  knowledgeBytes,
  parseKnowledgeEntry,
  personaEntryId,
  registerPersonas,
} from "@titan/knowledge";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CliOutputErrorSchema,
  PersonaBindingSchema,
  PersonaInspectionSchema,
  PersonaRecordSchema,
  PersonaRunRecordSchema,
  PersonaSchema,
  RunSchema,
  WorkflowSchema,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { runCliCommand } from "../support/command.ts";

export function personaMutationInheritance(clearTools: boolean, clearTags: boolean) {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    try {
      const original = {
        ...inline(PersonaRegister.RoleFirst),
        tools: [AgentTool.Read, AgentTool.Write],
        tags: [PersonaRegister.Judge],
      };
      await hub.registerPersonas(
        workflowOf({ [PersonaRegister.Judge]: original }, PersonaRegister.Judge),
      );
      const saved = (await hub.get(personaEntryId(PersonaRegister.JudgeFirst))).entry;
      const workflow = workflowOf(
        {
          [PersonaRegister.Judge]: {
            mutates: PersonaRegister.JudgeFirst,
            role: PersonaRegister.RoleSecond,
            ...(clearTools ? { tools: [] } : {}),
            ...(clearTags ? { tags: [] } : {}),
          },
        },
        PersonaRegister.Judge,
      );
      const bound = await hub.bindPersonas(workflow);
      const expected = PersonaSchema.parse({
        ...original,
        role: PersonaRegister.RoleSecond,
        tools: clearTools ? [] : original.tools,
        tags: clearTags ? [] : original.tags,
      });
      assert.deepEqual(bound.workflow.personas[PersonaRegister.Judge], expected);
      assert.equal(bound.references[PersonaRegister.Judge], PersonaRegister.JudgeSecond);
      const changed = (await hub.get(personaEntryId(PersonaRegister.JudgeSecond))).entry;
      assert.deepEqual(PersonaRecordSchema.parse(Bun.YAML.parse(changed.body)).persona, expected);
      assert.deepEqual((await hub.get(saved.id)).entry, saved);
      return true;
    } finally {
      await hub.close();
    }
  });
}

export function personaBindingRetry(
  mutation: boolean,
  interleaved: boolean,
  corrupt = false,
  parent = false,
) {
  return withTemporaryDirectory(async (home) => {
    let hub = await KnowledgeHub.open(home);
    try {
      await hub.registerPersonas(
        workflowOf(
          {
            [PersonaRegister.Judge]: inline(PersonaRegister.RoleFirst),
          },
          PersonaRegister.Judge,
        ),
      );
      const workflow = workflowOf(
        {
          [PersonaRegister.Judge]: mutation
            ? { mutates: PersonaRegister.JudgeFirst, role: PersonaRegister.RoleSecond }
            : inline(PersonaRegister.RoleSecond),
        },
        PersonaRegister.Judge,
      );
      const bind = async () =>
        PersonaBindingSchema.parse(
          await Reflect.apply(hub.bindPersonas, hub, [workflow, hash(PersonaRegister.Note)]),
        );
      const first = await bind();
      assert.equal(first.references[PersonaRegister.Judge], PersonaRegister.JudgeSecond);
      const saved = (await hub.get(personaEntryId(PersonaRegister.JudgeSecond))).entry;
      if (interleaved)
        await hub.registerPersonas(
          workflowOf(
            {
              [PersonaRegister.Judge]: mutation
                ? { mutates: PersonaRegister.JudgeFirst, role: PersonaRegister.RoleFirst }
                : inline(PersonaRegister.RoleFirst),
            },
            PersonaRegister.Judge,
          ),
        );
      await hub.close();
      if (corrupt) {
        const body = PersonaRecordSchema.parse(Bun.YAML.parse(saved.body));
        const changed = parent
          ? { ...body, parent: PersonaRegister.JudgeSecond }
          : {
              ...body,
              persona: { ...body.persona, role: PersonaRegister.RoleMutated },
            };
        await writeFile(
          registerFile(home, PersonaRegister.Judge, 2),
          knowledgeBytes(
            { ...saved, body: Bun.YAML.stringify(changed) },
            KnowledgeLimit.EntryBytes,
          ),
        );
      }
      hub = await KnowledgeHub.open(home);
      if (corrupt) {
        await assert.rejects(bind(), { code: ErrorCode.KnowledgeCorrupt });
        return true;
      }
      assert.deepEqual((await bind()).references, first.references);
      assert.deepEqual((await hub.get(saved.id)).entry, saved);
      assert.equal(
        await Bun.file(registerFile(home, PersonaRegister.Judge, interleaved ? 4 : 3)).exists(),
        false,
      );
      return true;
    } finally {
      await hub.close();
    }
  });
}

export function personaShow(selector: string, missing: boolean, cli = Packaging.CliSource) {
  return withTemporaryDirectory(async (home) => {
    await registerPersonas(
      home,
      workflowOf(
        { [PersonaRegister.Judge]: inline(PersonaRegister.RoleFirst) },
        PersonaRegister.Judge,
      ),
    );
    await registerPersonas(
      home,
      workflowOf(
        { [PersonaRegister.Judge]: inline(PersonaRegister.RoleSecond) },
        PersonaRegister.Judge,
      ),
    );
    const file = registerFile(home, PersonaRegister.Judge, 1);
    const before = await readFile(file);
    const data = await runCliCommand(
      cli,
      home,
      ["persona", "show", selector],
      missing ? ExitCode.Input : ExitCode.Success,
    );
    await personaShowLocally(home, [selector], missing ? ErrorCode.UnknownPersona : null);
    if (missing) {
      assert.equal(CliOutputErrorSchema.parse(data).code, ErrorCode.UnknownPersona);
    } else {
      const page = PersonaInspectionSchema.parse(data);
      const record = page.versions[0];
      assert(record);
      const first = selector === PersonaRegister.JudgeFirst;
      assert.equal(page.versions.length, first ? 1 : 2);
      assert.equal(record.name, PersonaRegister.Judge);
      assert.equal(record.version, first ? 1 : 2);
      assert.equal(
        record.persona.role,
        first ? PersonaRegister.RoleFirst : PersonaRegister.RoleSecond,
      );
      assert.equal(record.state, PersonaState.Proposed);
      assert.equal(record.uses, 0);
      if (!first) {
        const next = PersonaInspectionSchema.parse(
          await runCliCommand(cli, home, ["persona", "show", selector, "--limit", "1"]),
        );
        assert.equal(next.has_more, true);
        assert.equal(next.next_version, 2);
        const previous = PersonaInspectionSchema.parse(
          await runCliCommand(cli, home, [
            "persona",
            "show",
            selector,
            "--before",
            String(next.next_version),
            "--limit",
            "1",
          ]),
        );
        assert.equal(previous.versions[0]?.version, 1);
        assert.equal(previous.has_more, false);
      }
    }
    assert.deepEqual(await readFile(file), before);
    return true;
  });
}

export function personaShowPage(limit: string, before: string, valid: boolean) {
  return withTemporaryDirectory(async (home) => {
    await registerPersonas(
      home,
      workflowOf(
        { [PersonaRegister.Judge]: inline(PersonaRegister.RoleFirst) },
        PersonaRegister.Judge,
      ),
    );
    await registerPersonas(
      home,
      workflowOf(
        { [PersonaRegister.Judge]: inline(PersonaRegister.RoleSecond) },
        PersonaRegister.Judge,
      ),
    );
    const data = await runCliCommand(
      Packaging.CliSource,
      home,
      ["persona", "show", PersonaRegister.Judge, "--limit", limit, "--before", before],
      valid ? ExitCode.Success : ExitCode.Input,
    );
    await personaShowLocally(
      home,
      [PersonaRegister.Judge, "--limit", limit, "--before", before],
      valid ? null : ErrorCode.Arguments,
    );
    if (!valid) {
      assert.equal(CliOutputErrorSchema.parse(data).code, ErrorCode.Arguments);
      return true;
    }
    const page = PersonaInspectionSchema.parse(data);
    assert(page.versions.length <= Number(limit));
    assert(page.versions.every((record) => record.version < Number(before)));
    assert.equal(page.versions[0]?.version, Number(before) - 1);
    return true;
  });
}

async function personaShowLocally(
  home: string,
  args: string[],
  code: ErrorCode | null,
): Promise<void> {
  const invoke = () => runCli(["persona", "show", ...args, "--home", home, "--json"]);
  if (code === null) {
    assert.equal(await invoke(), ExitCode.Success);
    return;
  }
  const error = await thrownBy(invoke);
  assert(error instanceof TitanError);
  assert.equal(error.code, code);
}

function inline(role: string) {
  return { description: PersonaRegister.Description, role };
}

function workflowOf(personas: Record<string, unknown>, worker: string) {
  return WorkflowSchema.parse({
    name: PersonaRegister.WorkflowName,
    goal: PersonaRegister.Goal,
    personas: { ...personas, [PersonaRegister.Checker]: inline(PersonaRegister.CheckerRole) },
    steps: [
      {
        id: PersonaRegister.StepId,
        do: { persona: worker, task: PersonaRegister.Task },
        falsify: [{ persona: PersonaRegister.Checker, task: PersonaRegister.Check }],
      },
    ],
  });
}

function registerFile(home: string, name: string, version: number): string {
  return join(
    home,
    KnowledgeFile.Directory,
    KnowledgeKind.Persona,
    personaEntryId(name + PersonaRule.VersionMark + version) + KnowledgeFile.Yaml,
  );
}

function recordOf(text: string) {
  return PersonaRecordSchema.parse(
    Bun.YAML.parse(parseKnowledgeEntry(Buffer.from(text), KnowledgeLimit.EntryBytes).body),
  );
}

async function saved(home: string, name: string): Promise<boolean> {
  return Bun.file(registerFile(home, name, 1)).exists();
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
}

async function runCli(args: string[]): Promise<number> {
  const output: unknown[] = [];
  return createCli({ ...defaultServices, output: (value) => output.push(value) })(args);
}

async function submitted(home: string, project: string, name: string, extra: string[]) {
  const file = resolve(project, PersonaRegister.Workflow);
  await writeFile(
    file,
    Buffer.from(
      Bun.YAML.stringify(workflowOf({ [name]: inline(PersonaRegister.RoleFirst) }, name)),
    ),
  );
  const backend = new FakeBackend(async (spec) =>
    spec.persona_id === name
      ? { json: { note: PersonaRegister.Note } }
      : { json: { verdict: Verdict.Survived, evidence: PersonaRegister.Evidence } },
  );
  const server = await startServer(home, () => backend);
  return {
    server,
    args: [
      "run",
      file,
      `--${CliOption.Project}`,
      project,
      `--${CliOption.Backend}`,
      PersonaRegister.Backend,
      ...(extra.includes(`--${CliOption.DryRun}`) ? [] : [`--${CliOption.Detach}`]),
      `--${CliOption.Json}`,
      ...extra,
    ],
  };
}

async function settled(home: string): Promise<string[]> {
  const client = createRunClient(home);
  const ids = (await client.list()).runs.map((run) => run.run_id);
  await waitUntil(async () =>
    (await all(ids.map((id) => () => client.get(id)))).every(
      (run) => run.state === RunStatus.Passed,
    ),
  );
  return ids;
}

export async function personaFromRun(name: string, runs: number, dry: boolean): Promise<string> {
  return withTemporaryDirectory(async (home) => {
    await using resources = new AsyncDisposableStack();
    const { server, args } = await submitted(home, home, name, [
      `--${CliOption.Home}`,
      home,
      ...(dry ? [`--${CliOption.DryRun}`] : []),
    ]);
    resources.defer(() => server.stop());
    for (let run = 0; run < runs; run++) assert.equal(await runCli(args), ExitCode.Success);
    const [first] = await settled(home);
    let recorded: string = PersonaRegister.NoRecord;
    if (first !== undefined) {
      const root = (await createRunClient(home).get(first)).root;
      const record = PersonaRunRecordSchema.parse(
        JSON.parse(await readFile(join(root, PersonaRegister.RunFile), FileEncoding.Utf8)),
      );
      recorded = record[name] ?? PersonaRegister.NoRecord;
    }
    return `${await saved(home, name)} ${recorded}`;
  });
}

export async function personaHome(name: string, source: PersonaHomeSource): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const environment = resolve(root, PersonaHomeSource.Environment);
    const option = resolve(root, PersonaHomeSource.Option);
    const stray = resolve(root, PersonaRegister.Strays);
    const project = resolve(root, PersonaRegister.Project);
    for (const folder of [environment, option, stray, project])
      await mkdir(folder, { recursive: true });
    const target = source === PersonaHomeSource.Environment ? environment : option;
    const previous = [process.env[EnvVar.TitanHome], process.env[PersonaRegister.HomeVariable]];
    process.env[EnvVar.TitanHome] = environment;
    process.env[PersonaRegister.HomeVariable] = stray;
    try {
      await using resources = new AsyncDisposableStack();
      const { server, args } = await submitted(
        target,
        project,
        name,
        source === PersonaHomeSource.Option ? [`--${CliOption.Home}`, option] : [],
      );
      resources.defer(() => server.stop());
      assert.equal(await runCli(args), ExitCode.Success);
      await settled(target);
    } finally {
      restore(EnvVar.TitanHome, previous[0]);
      restore(PersonaRegister.HomeVariable, previous[1]);
    }
    const strayed = (await readdir(stray)).includes(ConfigFile.HomeDirectory);
    return `${await saved(environment, name)} ${await saved(option, name)} ${strayed}`;
  });
}

export async function personaMutate(base: string, role: string): Promise<string> {
  return withTemporaryDirectory(async (home) => {
    const judged = (entry: unknown) =>
      workflowOf({ [PersonaRegister.Judge]: entry }, PersonaRegister.Judge);
    await registerPersonas(home, judged(inline(PersonaRegister.RoleFirst)));
    await registerPersonas(home, judged(inline(PersonaRegister.RoleSecond)));
    const read = (version: number) =>
      readFile(registerFile(home, PersonaRegister.Judge, version), FileEncoding.Utf8);
    const before = [await read(1), await read(2)];
    const references = await registerPersonas(home, judged({ mutates: base, role }));
    const record = recordOf(await read(3));
    const first = before[0] === (await read(1));
    const second = before[1] === (await read(2));
    return `${references[PersonaRegister.Judge]} ${record.version} ${record.parent} ${record.persona.role} ${first} ${second}`;
  });
}

async function seeded(home: string, versions: number): Promise<void> {
  for (let version = 1; version <= versions; version++)
    await registerPersonas(
      home,
      workflowOf(
        { [PersonaRegister.Judge]: inline(`${PersonaRegister.RoleFirst} ${version}`) },
        PersonaRegister.Judge,
      ),
    );
}

async function damage(home: string, version: number, text: string): Promise<void> {
  await writeFile(registerFile(home, PersonaRegister.Judge, version), text);
}

export async function personaEntry(versions: number, broken: boolean): Promise<string> {
  return withTemporaryDirectory(async (home) => {
    await seeded(home, versions);
    const file = registerFile(home, PersonaRegister.Judge, versions);
    const text = await readFile(file, FileEncoding.Utf8);
    const bytes = Buffer.from(broken ? text.replace(KnowledgeKind.Persona, "bogus") : text);
    const entry = parseKnowledgeEntry(bytes, KnowledgeLimit.EntryBytes);
    return `${entry.kind} ${entry.title} ${entry.version} ${entry.id === personaEntryId(entry.title)}`;
  });
}

export async function personaOpen(versions: number, broken: boolean): Promise<string> {
  return withTemporaryDirectory(async (home) => {
    await seeded(home, versions);
    if (broken) await damage(home, 1, PersonaRegister.Broken);
    const hub = await KnowledgeHub.open(home);
    try {
      const title = PersonaRegister.Judge + PersonaRule.VersionMark + versions;
      const found = await hub.get(personaEntryId(title));
      return `${found.entry.kind} ${found.entry.title}`;
    } finally {
      await hub.close();
    }
  });
}

export async function personaRegisterUse(reference: string, versions: number): Promise<string> {
  return withTemporaryDirectory(async (home) => {
    await seeded(home, versions);
    const references = await registerPersonas(
      home,
      workflowOf(
        {
          [PersonaRegister.Skeptic]: { use: reference },
          [PersonaRegister.Fixer]: inline(PersonaRegister.RoleFirst),
        },
        PersonaRegister.Fixer,
      ),
    );
    return `${references[PersonaRegister.Skeptic]} ${references[PersonaRegister.Fixer]}`;
  });
}

export async function personaRegisterBroken(broken: boolean): Promise<string> {
  return withTemporaryDirectory(async (home) => {
    await seeded(home, 1);
    if (broken) await damage(home, 1, PersonaRegister.Broken);
    const references = await registerPersonas(
      home,
      workflowOf(
        { [PersonaRegister.Judge]: inline(`${PersonaRegister.RoleFirst} 1`) },
        PersonaRegister.Judge,
      ),
    );
    return references[PersonaRegister.Judge] ?? PersonaRegister.NoRecord;
  });
}

export async function personaUse(reference: string, versions: number): Promise<number> {
  return withTemporaryDirectory(async (home) => {
    for (let version = 1; version <= versions; version++)
      await registerPersonas(
        home,
        workflowOf(
          {
            [PersonaRegister.Skeptic]: inline(`${PersonaRegister.RoleFirst} ${version}`),
            [PersonaRegister.Fixer]: inline(PersonaRegister.RoleFirst),
          },
          PersonaRegister.Fixer,
        ),
      );
    const file = resolve(home, PersonaRegister.Workflow);
    await writeFile(
      file,
      Buffer.from(
        Bun.YAML.stringify(
          workflowOf(
            {
              [PersonaRegister.Skeptic]: { use: reference },
              [PersonaRegister.Fixer]: inline(PersonaRegister.RoleFirst),
            },
            PersonaRegister.Fixer,
          ),
        ),
      ),
    );
    return runCli(["check", file, `--${CliOption.Home}`, home, `--${CliOption.Project}`, home]);
  });
}

export async function personaRegistryOwner(
  different: boolean,
  closed: boolean,
  mutation = false,
): Promise<string> {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    try {
      if (mutation)
        await hub.registerPersonas(
          workflowOf(
            {
              [PersonaRegister.Judge]: inline(PersonaRegister.RoleFirst),
            },
            PersonaRegister.Judge,
          ),
        );
      if (closed) await hub.close();
      const workflows = Array.from({ length: 4 }, (_, index) => {
        const role = different
          ? `${PersonaRegister.RoleFirst} ${index}`
          : PersonaRegister.RoleFirst;
        const entry = mutation ? { mutates: PersonaRegister.JudgeFirst, role } : inline(role);
        return workflowOf({ [PersonaRegister.Judge]: entry }, PersonaRegister.Judge);
      });
      const records = await all(workflows.map((workflow) => () => hub.registerPersonas(workflow)));
      const references = records.map((record) => record[PersonaRegister.Judge]);
      assert.equal(new Set(references).size, different || mutation ? 4 : 1);
      for (const value of references) {
        const result = await hub.get(personaEntryId(value as string));
        assert.equal(result.entry.title, value);
      }
      const { entries } = await hub.stats();
      assert.equal(entries, mutation ? 6 : different ? 5 : 2);
      return `${references.length} ${entries}`;
    } finally {
      await hub.close();
    }
  });
}

export async function personaRegistryRecovery(
  interrupted: boolean,
  index: boolean,
): Promise<string> {
  return withTemporaryDirectory(async (home) => {
    const workflow = workflowOf(
      { [PersonaRegister.Judge]: inline(PersonaRegister.RoleFirst) },
      PersonaRegister.Judge,
    );
    let failed = false;
    const hub = await KnowledgeHub.open(home, {}, async (stage) => {
      if (
        interrupted &&
        !failed &&
        stage === (index ? KnowledgePublicationStage.Index : KnowledgePublicationStage.Journal)
      ) {
        failed = true;
        throw new Error(PersonaRegister.Broken);
      }
    });
    try {
      if (interrupted) await assert.rejects(hub.registerPersonas(workflow));
      else await hub.registerPersonas(workflow);
    } finally {
      await hub.close();
    }
    const recovered = await KnowledgeHub.open(home);
    try {
      const records = await recovered.registerPersonas(workflow);
      assert.equal(records[PersonaRegister.Judge], PersonaRegister.JudgeFirst);
      assert.equal(
        (await recovered.get(personaEntryId(PersonaRegister.JudgeFirst))).entry.title,
        PersonaRegister.JudgeFirst,
      );
      assert.equal((await recovered.stats()).entries, 2);
      return `${failed} ${records[PersonaRegister.Judge]}`;
    } finally {
      await recovered.close();
    }
  });
}

export async function personaResolvedRun(
  mutation: boolean,
  restart: boolean,
  missing: boolean,
  cli = false,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const original = workflowOf(
      { [PersonaRegister.Judge]: inline(PersonaRegister.RoleFirst) },
      PersonaRegister.Judge,
    );
    await registerPersonas(home, original);
    const parent = missing ? PersonaRegister.JudgeMissing : PersonaRegister.JudgeFirst;
    const workflow = workflowOf(
      {
        [PersonaRegister.Judge]: mutation
          ? { mutates: parent, role: PersonaRegister.RoleMutated }
          : { use: parent },
      },
      PersonaRegister.Judge,
    );
    const file = resolve(home, PersonaRegister.Workflow);
    const source = `# Retain persona references\n${Bun.YAML.stringify(workflow)}`;
    await writeFile(file, source);
    let executions = 0;
    const factory = () =>
      new FakeBackend(async (spec) => {
        executions++;
        if (spec.persona_id === PersonaRegister.Judge) {
          assert.equal(
            spec.role,
            mutation ? PersonaRegister.RoleMutated : PersonaRegister.RoleFirst,
          );
          return { json: { note: PersonaRegister.Note } };
        }
        return { json: { verdict: Verdict.Survived, evidence: PersonaRegister.Evidence } };
      });
    let server = await startServer(home, factory);
    const client = createRunClient(home);
    const body = {
      project: home,
      workflow,
      backend: Backend.Fake,
      client_id: "persona-caller",
      submission_id: "persona-submission",
      preserve_source: true,
      workflow_path: file,
    };
    const args = [
      "run",
      file,
      "--home",
      home,
      "--project",
      home,
      "--backend",
      Backend.Fake,
      "--client-id",
      body.client_id,
      "--submission-id",
      body.submission_id,
      "--detach",
      "--json",
    ];
    async function invoke() {
      if (!cli) return client.submit(body);
      assert.equal(await runCli(args), ExitCode.Success);
      const [run] = (await client.list()).runs;
      assert.ok(run);
      return client.get(run.run_id);
    }
    try {
      if (missing) {
        const error = await thrownBy(() => (cli ? runCli(args) : client.submit(body)));
        assert.equal(Reflect.get(Object(error), "code"), ErrorCode.UnknownPersona);
        assert.equal(executions, 0);
        assert.equal((await client.list()).runs.length, 0);
        return true;
      }
      const run = RunSchema.parse(await invoke());
      await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed);
      const saved = RunSchema.parse(await client.get(run.run_id));
      assert.equal(
        saved.schema_version,
        saved.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
      );
      assert.equal(saved.workflow_revision, validateWorkflow(workflow).revision);
      assert.equal(saved.source_plan?.revision, saved.workflow_revision);
      assert.deepEqual(saved.source_plan?.workflow, workflow);
      assert.equal(
        await readFile(resolve(saved.root, RunFile.Workflow), FileEncoding.Utf8),
        source,
      );
      const records = PersonaRunRecordSchema.parse(
        JSON.parse(await readFile(resolve(saved.root, PersonaRegister.RunFile), FileEncoding.Utf8)),
      );
      assert.equal(
        records[PersonaRegister.Judge],
        mutation ? PersonaRegister.JudgeSecond : PersonaRegister.JudgeFirst,
      );
      if (restart) {
        await server.stop();
        server = await startServer(home, factory);
      }
      assert.equal(RunSchema.parse(await invoke()).run_id, saved.run_id);
      assert.deepEqual(await client.get(saved.run_id), saved);
      assert.equal(executions, 2);
      return true;
    } finally {
      await server.stop();
    }
  });
}

export async function personaRegistryIdentity(
  changed: boolean,
  mismatch: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const workflow = workflowOf(
      { [PersonaRegister.Judge]: inline(PersonaRegister.RoleFirst) },
      PersonaRegister.Judge,
    );
    await registerPersonas(home, workflow);
    const path = registerFile(home, PersonaRegister.Judge, 1);
    const entry = parseKnowledgeEntry(await readFile(path), KnowledgeLimit.EntryBytes);
    const record = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
    const body = mismatch
      ? { ...record, ...(changed ? { version: 2 } : { name: "another" }) }
      : record;
    await writeFile(
      path,
      knowledgeBytes({ ...entry, body: Bun.YAML.stringify(body) }, KnowledgeLimit.EntryBytes),
    );
    const hub = await KnowledgeHub.open(home);
    try {
      if (changed && !mismatch) await hub.registerPersonas(workflow);
      await hub.resolvePersonas(
        workflowOf(
          {
            [PersonaRegister.Judge]: {
              use: PersonaRegister.JudgeFirst,
            },
          },
          PersonaRegister.Judge,
        ),
      );
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function personaDefinitionUpdate(
  batch: boolean,
  changed: boolean,
  identity: boolean,
  registration = false,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const hub = await KnowledgeHub.open(home);
    try {
      await hub.registerPersonas(
        workflowOf(
          { [PersonaRegister.Judge]: inline(PersonaRegister.RoleFirst) },
          PersonaRegister.Judge,
        ),
      );
      const { entry } = await hub.get(personaEntryId(PersonaRegister.JudgeFirst));
      const record = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
      const next = registration
        ? { ...record, registration: hash(PersonaRegister.Note) }
        : changed
          ? identity
            ? { ...record, version: record.version + 1 }
            : { ...record, persona: { ...record.persona, role: PersonaRegister.RoleMutated } }
          : { ...record, state: PersonaState.Trial };
      const { id, version, ...draft } = entry;
      const update = { ...draft, body: Bun.YAML.stringify(next) };
      const publish = () =>
        batch
          ? hub.commit({
              publication_id: personaEntryId("persona-definition"),
              mutations: [{ id, version, entry: update }],
            })
          : hub.update({ id, version, entry: update });
      if (changed || registration) {
        await assert.rejects(publish(), { code: ErrorCode.PermissionDenied });
        assert.deepEqual((await hub.get(entry.id)).entry, entry);
      } else {
        await publish();
        assert.equal(
          PersonaRecordSchema.parse(Bun.YAML.parse((await hub.get(entry.id)).entry.body)).state,
          PersonaState.Trial,
        );
        const resolved = await hub.resolvePersonas(
          workflowOf(
            { [PersonaRegister.Judge]: { use: PersonaRegister.JudgeFirst } },
            PersonaRegister.Judge,
          ),
        );
        assert.equal(
          PersonaSchema.parse(resolved.personas[PersonaRegister.Judge]).role,
          PersonaRegister.RoleFirst,
        );
      }
      return true;
    } finally {
      await hub.close();
    }
  });
}

export async function personaConcurrentSubmissions(
  different: boolean,
  missing: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    await registerPersonas(
      home,
      workflowOf(
        {
          [PersonaRegister.Judge]: inline(PersonaRegister.RoleFirst),
        },
        PersonaRegister.Judge,
      ),
    );
    const original = await readFile(registerFile(home, PersonaRegister.Judge, 1));
    let executions = 0;
    const server = await startServer(
      home,
      () =>
        new FakeBackend(async (spec) => {
          executions++;
          return spec.persona_id === PersonaRegister.Judge
            ? { json: { note: PersonaRegister.Note } }
            : { json: { verdict: Verdict.Survived, evidence: PersonaRegister.Evidence } };
        }),
    );
    const client = createRunClient(home);
    try {
      const bodies = Array.from({ length: 2 }, (_, index) => ({
        project: home,
        backend: Backend.Fake,
        client_id: "concurrent-personas",
        submission_id: `submission-${index}`,
        workflow: workflowOf(
          {
            [PersonaRegister.Judge]: {
              mutates: missing ? PersonaRegister.JudgeMissing : PersonaRegister.JudgeFirst,
              role: different
                ? `${PersonaRegister.RoleMutated} ${index}`
                : PersonaRegister.RoleMutated,
            },
          },
          PersonaRegister.Judge,
        ),
      }));
      const runs = await all(bodies.map((body) => () => client.submit(body))).catch(
        async (error: unknown) => {
          assert.equal(executions, 0);
          assert.equal((await client.list()).runs.length, 0);
          assert.deepEqual(await readFile(registerFile(home, PersonaRegister.Judge, 1)), original);
          throw error;
        },
      );
      await waitUntil(async () =>
        (await all(runs.map((run) => () => client.get(run.run_id)))).every(
          (run) => run.state === RunStatus.Passed,
        ),
      );
      const references = await all(
        runs.map(
          (run) => async () =>
            PersonaRunRecordSchema.parse(
              JSON.parse(
                await readFile(resolve(run.root, PersonaRegister.RunFile), FileEncoding.Utf8),
              ),
            )[PersonaRegister.Judge],
        ),
      );
      assert.deepEqual(references.sort(), ["judge@2", "judge@3"]);
      for (const body of bodies) await client.submit(body);
      assert.equal(executions, 4);
      assert.deepEqual(await readFile(registerFile(home, PersonaRegister.Judge, 1)), original);
      return true;
    } finally {
      await server.stop();
    }
  });
}
