import {
  ApprovalLevel,
  ErrorCode,
  FileEncoding,
  PersonaDecisionStage,
  PersonaReferencePattern,
  PersonaRule,
  PersonaState,
  RequestDecision,
  RequestKind,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  type OperationRequest,
  OperationRequestSchema,
  type PersonaReadResult,
  PersonaRecordSchema,
  type PersonaRegistryStorage,
} from "@titan/types";
import { readPersonaEntry } from "./persona-archive.ts";
import { personaEntryId, wilson } from "./persona-lifecycle.ts";
import { PersonaRegistry, personaRecord, splitReference } from "./persona-register.ts";

async function finishDeletion(storage: PersonaRegistryStorage, current: PersonaReadResult) {
  if (current.archived) return;
  await storage.publish({
    before: current.entry,
    before_text: current.bytes.toString(FileEncoding.Utf8),
    after: null,
  });
}

export async function publishPersonaDecision(
  storage: PersonaRegistryStorage,
  input: OperationRequest,
  stage: PersonaDecisionStage,
): Promise<void> {
  const request = OperationRequestSchema.parse(input);
  if (request.answer?.persona) {
    await approveDefinition(storage, request, stage);
    return;
  }
  if (
    request.answer?.decision !== RequestDecision.Approve ||
    ![RequestKind.NewPersona, RequestKind.RetirePersona, RequestKind.DeletePersona].includes(
      request.kind,
    )
  )
    return;
  if (
    request.answer.actor.authority === ApprovalLevel.Auto ||
    (request.kind === RequestKind.DeletePersona &&
      request.answer.actor.authority !== ApprovalLevel.Human) ||
    request.scope.operation !== request.kind ||
    !PersonaReferencePattern.test(request.scope.resource)
  )
    throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDecision);
  const { name, version } = splitReference(request.scope.resource);
  const current = await readPersonaEntry(storage, personaEntryId(request.scope.resource));
  const { entry, bytes } = current;
  const record = personaRecord(entry, name, version);
  const fingerprint = hash(JSON.stringify(request));
  const previous = record.decisions?.find(
    (saved) => saved.run === request.run_id && saved.request_id === request.request_id,
  );
  if (previous) {
    if (previous.request !== fingerprint)
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    if (request.kind === RequestKind.DeletePersona && stage === PersonaDecisionStage.Publish)
      await finishDeletion(storage, current);
    return;
  }
  const from = record.state ?? PersonaState.Proposed;
  if (from === PersonaState.Deleted)
    throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDefinition);
  const to =
    request.kind === RequestKind.DeletePersona
      ? PersonaState.Deleted
      : request.kind === RequestKind.RetirePersona
        ? PersonaState.Retired
        : from === PersonaState.Proposed
          ? PersonaState.Trial
          : from;
  const survived = record.survived ?? 0;
  const total = survived + (record.refuted ?? 0);
  const bounds = wilson(survived, total);
  const after = PersonaRecordSchema.parse({
    ...record,
    state: to,
    decisions: [
      ...(record.decisions ?? []),
      {
        run: request.run_id,
        request_id: request.request_id,
        request: fingerprint,
        move: {
          persona: request.scope.resource,
          from,
          to,
          survived,
          total,
          ...bounds,
          bar: PersonaRule.Bar,
        },
      },
    ],
  });
  if (stage === PersonaDecisionStage.Validate) return;
  await storage.publish({
    before: entry,
    before_text: bytes.toString(FileEncoding.Utf8),
    after: { ...entry, version: entry.version + 1, body: Bun.YAML.stringify(after, null, 2) },
  });
  if (request.kind === RequestKind.DeletePersona)
    await finishDeletion(storage, await readPersonaEntry(storage, entry.id));
}

async function approveDefinition(
  storage: PersonaRegistryStorage,
  request: OperationRequest,
  stage: PersonaDecisionStage,
): Promise<void> {
  const supplied = request.answer?.persona;
  if (
    !supplied ||
    request.answer?.actor.authority === ApprovalLevel.Auto ||
    request.scope.operation !== request.kind
  )
    throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDecision);
  let parent: string | undefined;
  if (request.kind === RequestKind.NewPersona) {
    const tags = supplied.definition.tags;
    const tagRequest =
      request.scope.arguments.length > 1 &&
      request.scope.arguments.slice(1).join(PersonaRule.TagSeparator) === request.scope.resource;
    if (
      (tagRequest || request.scope.resource !== supplied.name) &&
      !request.scope.resource.split(PersonaRule.TagSeparator).every((tag) => tags.includes(tag))
    )
      throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDecision);
  } else {
    const sources = request.scope.resource.split(PersonaRule.TagSeparator);
    if (
      (request.kind === RequestKind.ImprovePersona
        ? sources.length < 1 || sources.length > 2
        : sources.length !== 2) ||
      new Set(sources).size !== sources.length ||
      !sources.every((value) => PersonaReferencePattern.test(value))
    )
      throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDecision);
    for (const source of sources) {
      const { name, version } = splitReference(source);
      const { entry } = await storage.read(personaEntryId(source));
      const record = personaRecord(entry, name, version);
      if (record.state === PersonaState.Deleted)
        throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDefinition);
      if (
        name === supplied.name &&
        (parent === undefined || version > splitReference(parent).version)
      )
        parent = source;
    }
    if (
      request.kind === RequestKind.ImprovePersona &&
      sources.some((source) => splitReference(source).name !== supplied.name)
    )
      throw new TitanError(ErrorCode.PermissionDenied, KnowledgeMessage.PersonaDecision);
  }
  await new PersonaRegistry(storage).approve(request, parent, stage);
}
