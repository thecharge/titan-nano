import {
  ErrorCode,
  FileEncoding,
  KnowledgeKind,
  KnowledgeLimit,
  NativeToolRole,
  PersonaReferencePattern,
  PersonaRule,
  Verdict,
} from "@titan/constants";
import { uuidFromText } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import type {
  KnowledgeChange,
  PersonaQualityResult,
  PersonaQualityStorage,
  PersonaRecord,
  PersonaSampling,
} from "@titan/types";
import { personaEntryId } from "./persona-lifecycle.ts";
import { personaRecord, splitReference } from "./persona-register.ts";

function counts(record: PersonaRecord): PersonaSampling {
  const workers = record.history?.filter((saved) => saved.role === NativeToolRole.Worker) ?? [];
  return (
    record.sampling ?? {
      survived:
        record.survived ?? workers.filter((saved) => saved.verdict === Verdict.Survived).length,
      refuted:
        record.refuted ?? workers.filter((saved) => saved.verdict === Verdict.Refuted).length,
    }
  );
}

function faded(record: PersonaRecord): PersonaSampling {
  const current = counts(record);
  return {
    survived: current.survived * PersonaRule.Fade,
    refuted: current.refuted * PersonaRule.Fade,
  };
}

function tagSet(record: PersonaRecord): string {
  return JSON.stringify([...new Set(record.persona.tags)].sort());
}

export async function publishPersonaSampling(
  storage: PersonaQualityStorage,
  change: KnowledgeChange,
  before: PersonaRecord,
  after: PersonaRecord,
  result: PersonaQualityResult,
  outcome: string,
): Promise<void> {
  const sampling = faded(before);
  sampling.survived += Number(result.verdict === Verdict.Survived);
  sampling.refuted += Number(result.verdict === Verdict.Refuted);
  const target: KnowledgeChange = {
    ...change,
    after: change.after && {
      ...change.after,
      body: Bun.YAML.stringify({ ...after, sampling }, null, 2),
    },
  };
  const changes: KnowledgeChange[] = [target];
  for await (const row of storage.rows()) {
    if (
      row.id === change.before?.id ||
      row.kind !== KnowledgeKind.Persona ||
      !PersonaReferencePattern.test(row.title) ||
      row.id !== personaEntryId(row.title)
    )
      continue;
    const { entry, bytes } = await storage.read(row.id);
    const { name, version } = splitReference(row.title);
    const record = personaRecord(entry, name, version);
    if (tagSet(record) !== tagSet(before)) continue;
    const next = faded(record);
    if (JSON.stringify(next) === JSON.stringify(counts(record))) continue;
    if (changes.length >= KnowledgeLimit.PublicationEntries)
      throw new TitanError(ErrorCode.Capacity, KnowledgeMessage.Capacity);
    changes.push({
      before: entry,
      before_text: bytes.toString(FileEncoding.Utf8),
      after: {
        ...entry,
        version: entry.version + 1,
        body: Bun.YAML.stringify({ ...record, sampling: next }, null, 2),
      },
    });
  }
  if (changes.length === 1) await storage.publish(target);
  else await storage.publishMany(uuidFromText(outcome), changes);
}
