import { join } from "node:path";
import { assertNoSecrets } from "@titan/config";
import {
  ConfigFile,
  ErrorCode,
  ErrorField,
  FileErrorCode,
  KnowledgeFile,
  KnowledgeKind,
  KnowledgeLimit,
  PersonaDecisionStage,
  PersonaReferencePattern,
  PersonaRegister,
  PersonaRule,
  PersonaState,
  ProjectPersonaPrefix,
  WorkflowField,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage, personaNotInRegister } from "@titan/messages";
import { atomicWrite } from "@titan/streams";
import {
  type KnowledgeChange,
  type KnowledgeEntry,
  KnowledgeEntrySchema,
  type OperationRequest,
  type Persona,
  type PersonaChanges,
  type PersonaEntry,
  type PersonaMap,
  type PersonaRecord,
  PersonaRecordSchema,
  type PersonaReferenceParts,
  type PersonaRegistryStorage,
  type PersonaRunRecord,
  PersonaRunRecordSchema,
  PersonaSchema,
  RequestPersonaSchema,
  type Workflow,
  WorkflowSchema,
} from "@titan/types";
import { knowledgePath, readKnowledgeBytes } from "./files.ts";
import { parseKnowledgeEntry } from "./format.ts";
import { archivedPersona } from "./persona-archive.ts";
import {
  emptyPersonaUsage,
  personaEntryId,
  personaReference as reference,
} from "./persona-lifecycle.ts";

function filePath(home: string, name: string, version: number): string {
  return knowledgePath(
    join(home, KnowledgeFile.Directory),
    KnowledgeKind.Persona,
    personaEntryId(reference(name, version)),
  );
}

export function splitReference(value: string): PersonaReferenceParts {
  const at = value.lastIndexOf(PersonaRule.VersionMark);
  return { name: value.slice(0, at), version: Number(value.slice(at + 1)) };
}

export function localPersonaReference(value: string): string {
  return value.startsWith(ProjectPersonaPrefix) ? value.slice(ProjectPersonaPrefix.length) : value;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing;
}

async function readRecord(
  home: string,
  name: string,
  version: number,
): Promise<PersonaRecord | undefined> {
  try {
    const bytes = await readKnowledgeBytes(
      filePath(home, name, version),
      KnowledgeLimit.EntryBytes,
    );
    assertNoSecrets(bytes);
    const entry = parseKnowledgeEntry(bytes, KnowledgeLimit.EntryBytes);
    return personaRecord(entry, name, version);
  } catch (error) {
    if (isMissing(error)) {
      const saved = await archivedPersona(
        join(home, KnowledgeFile.Directory),
        personaEntryId(reference(name, version)),
      );
      return saved ? personaRecord(saved.entry, name, version) : undefined;
    }
    throw error;
  }
}

export function personaRecord(entry: KnowledgeEntry, name: string, version: number): PersonaRecord {
  const title = reference(name, version);
  let record: PersonaRecord;
  try {
    record = PersonaRecordSchema.parse(Bun.YAML.parse(entry.body));
  } catch {
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  }
  if (
    entry.id !== personaEntryId(title) ||
    entry.kind !== KnowledgeKind.Persona ||
    entry.title !== title ||
    record.name !== name ||
    record.version !== version
  )
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  return record;
}

function samePersona(left: Persona, right: Persona): boolean {
  return JSON.stringify(PersonaSchema.parse(left)) === JSON.stringify(PersonaSchema.parse(right));
}

export function assertPersonaDefinition({ before, after }: KnowledgeChange): void {
  if (
    !before ||
    !after ||
    before.kind !== KnowledgeKind.Persona ||
    !PersonaReferencePattern.test(before.title) ||
    before.id !== personaEntryId(before.title)
  )
    return;
  const { name, version } = splitReference(before.title);
  const saved = personaRecord(before, name, version);
  try {
    const next = personaRecord(after, name, version);
    if (
      saved.parent === next.parent &&
      saved.registration === next.registration &&
      samePersona(saved.persona, next.persona)
    )
      return;
  } catch {}
  throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDefinition);
}

async function existing(home: string, value: string): Promise<PersonaRecord> {
  const { name, version } = splitReference(value);
  const record = await readRecord(home, name, version);
  if (!record || record.state === PersonaState.Deleted)
    throw new TitanError(ErrorCode.UnknownPersona, personaNotInRegister(value));
  return record;
}

export class PersonaRegistry {
  constructor(
    private storage: PersonaRegistryStorage,
    private project?: PersonaRegistry,
  ) {}

  async approve(
    request: OperationRequest,
    parent: string | undefined,
    stage: PersonaDecisionStage,
  ): Promise<string> {
    const supplied = RequestPersonaSchema.parse(request.answer?.persona);
    const registration = hash(JSON.stringify(request));
    const stored = await this.latest(supplied.name, registration);
    if (stored?.registration === registration) {
      if (
        !samePersona(stored.persona, supplied.definition) ||
        (parent !== undefined && stored.parent !== parent) ||
        !stored.decisions?.some((receipt) => receipt.request === registration)
      )
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
      return reference(stored.name, stored.version);
    }
    const version = (stored?.version ?? 0) + 1;
    const title = reference(supplied.name, version);
    const record = PersonaRecordSchema.parse({
      name: supplied.name,
      version,
      persona: supplied.definition,
      registration,
      ...(parent ? { parent } : stored ? { parent: reference(stored.name, stored.version) } : {}),
      state: PersonaState.Trial,
      decisions: [
        {
          run: request.run_id,
          request_id: request.request_id,
          request: registration,
          move: {
            persona: title,
            from: PersonaState.Proposed,
            to: PersonaState.Trial,
            survived: 0,
            total: 0,
            lower: 0,
            upper: 1,
            bar: PersonaRule.Bar,
          },
        },
      ],
    });
    assertNoSecrets(Buffer.from(Bun.YAML.stringify(record)));
    return stage === PersonaDecisionStage.Validate ? title : this.save(record);
  }

  private async read(name: string, version: number): Promise<PersonaRecord | undefined> {
    const title = reference(name, version);
    try {
      const { entry } = await this.storage.read(personaEntryId(title));
      return personaRecord(entry, name, version);
    } catch (error) {
      if (error instanceof TitanError && error.code === ErrorCode.KnowledgeMissing) {
        const saved = await this.storage.readArchived?.(personaEntryId(title));
        return saved ? personaRecord(saved.entry, name, version) : undefined;
      }
      throw error;
    }
  }

  private async latest(name: string, registration?: string): Promise<PersonaRecord | undefined> {
    let stored: PersonaRecord | undefined;
    let version: number = PersonaRegister.FirstVersion;
    while (true) {
      const record = await this.read(name, version++);
      if (!record) return stored;
      if (registration !== undefined && record.registration === registration) return record;
      stored = record;
    }
  }

  private async save(record: PersonaRecord): Promise<string> {
    const title = reference(record.name, record.version);
    await this.storage.publish({
      before: null,
      before_text: null,
      after: KnowledgeEntrySchema.parse({
        id: personaEntryId(title),
        kind: KnowledgeKind.Persona,
        title,
        tags: record.persona.tags,
        body: Bun.YAML.stringify(
          {
            state: PersonaState.Proposed,
            history: [],
            usage: emptyPersonaUsage(true),
            asked: 0,
            asked_history_complete: true,
            ...record,
          },
          null,
          2,
        ),
        version: PersonaRegister.FirstVersion,
      }),
    });
    return title;
  }

  private async existing(value: string): Promise<PersonaRecord> {
    if (value.startsWith(ProjectPersonaPrefix)) {
      if (!this.project)
        throw new TitanError(ErrorCode.UnknownPersona, personaNotInRegister(value));
      return this.project.existing(localPersonaReference(value));
    }
    const { name, version } = splitReference(value);
    const record = await this.read(name, version);
    if (!record || record.state === PersonaState.Deleted)
      throw new TitanError(ErrorCode.UnknownPersona, personaNotInRegister(value));
    return record;
  }

  private async inline(name: string, persona: Persona, registration?: string): Promise<string> {
    const stored = await this.latest(name, registration);
    if (!stored)
      return this.save({ name, version: PersonaRegister.FirstVersion, persona, registration });
    if (
      registration !== undefined &&
      stored.registration === registration &&
      !samePersona(stored.persona, persona)
    )
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    if (stored.state !== PersonaState.Deleted && samePersona(stored.persona, persona))
      return reference(name, stored.version);
    return this.save({
      name,
      version: stored.version + 1,
      parent: reference(name, stored.version),
      persona,
      registration,
    });
  }

  private async mutation(
    parent: string,
    changes: PersonaChanges,
    registration?: string,
  ): Promise<string> {
    const base = await this.existing(parent);
    const stored = await this.latest(base.name, registration);
    const persona = PersonaSchema.parse({ ...base.persona, ...changes });
    if (registration !== undefined && stored?.registration === registration) {
      if (stored.parent !== parent || !samePersona(stored.persona, persona))
        throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
      return reference(stored.name, stored.version);
    }
    return this.save({
      name: base.name,
      version: (stored?.version ?? base.version) + 1,
      parent,
      persona,
      registration,
    });
  }

  async register(workflow: Workflow, registration?: string): Promise<PersonaRunRecord> {
    const references: PersonaRunRecord = {};
    for (const [key, entry] of Object.entries(workflow.personas))
      references[key] = await this.registerEntry(
        key,
        entry,
        registration === undefined
          ? undefined
          : hash(JSON.stringify([registration, workflow, key])),
      );
    return references;
  }

  resolve(workflow: Workflow): Promise<Workflow> {
    return resolveWorkflow(workflow, (value) => this.existing(value));
  }

  private async registerEntry(
    key: string,
    entry: PersonaEntry,
    registration?: string,
  ): Promise<string> {
    if (WorkflowField.Use in entry) {
      await this.existing(entry.use);
      return entry.use;
    }
    if (WorkflowField.Mutates in entry) {
      const { mutates, ...changes } = entry;
      if (mutates.startsWith(ProjectPersonaPrefix)) {
        if (!this.project)
          throw new TitanError(ErrorCode.UnknownPersona, personaNotInRegister(mutates));
        return (
          ProjectPersonaPrefix +
          (await this.project.mutation(localPersonaReference(mutates), changes, registration))
        );
      }
      return this.mutation(mutates, changes, registration);
    }
    return this.inline(key, entry, registration);
  }
}

async function resolveEntry(
  entry: PersonaEntry,
  find: (value: string) => Promise<PersonaRecord>,
): Promise<Persona> {
  if (WorkflowField.Use in entry) {
    const { use, ...changes } = entry;
    return PersonaSchema.parse({ ...(await find(use)).persona, ...changes });
  }
  if (WorkflowField.Mutates in entry) {
    const { mutates, ...changes } = entry;
    return PersonaSchema.parse({ ...(await find(mutates)).persona, ...changes });
  }
  return entry;
}

async function resolveWorkflow(
  workflow: Workflow,
  find: (value: string) => Promise<PersonaRecord>,
): Promise<Workflow> {
  const personas: PersonaMap = {};
  for (const [name, entry] of Object.entries(workflow.personas))
    personas[name] = await resolveEntry(entry, find);
  return WorkflowSchema.parse({ ...workflow, personas });
}

export function resolvePersonaWorkflow(
  home: string,
  workflow: Workflow,
  project?: string,
): Promise<Workflow> {
  return resolveWorkflow(workflow, (value) => {
    if (!value.startsWith(ProjectPersonaPrefix)) return existing(home, value);
    if (!project) throw new TitanError(ErrorCode.UnknownPersona, personaNotInRegister(value));
    return existing(join(project, ConfigFile.HomeDirectory), localPersonaReference(value));
  });
}

export async function checkPersonaUses(
  home: string,
  workflow: Workflow,
  project?: string,
): Promise<void> {
  await resolvePersonaWorkflow(home, workflow, project);
}

export async function recordRunPersonas(root: string, references: PersonaRunRecord): Promise<void> {
  await atomicWrite(
    join(root, PersonaRegister.RunFile),
    JSON.stringify(PersonaRunRecordSchema.parse(references)),
  );
}
