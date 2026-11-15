import {
  ErrorCode,
  FileEncoding,
  NativeToolRole,
  PersonaRule,
  PersonaState,
  Verdict,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  type PersonaQualityResult,
  PersonaQualityResultSchema,
  type PersonaQualityStorage,
  PersonaRecordSchema,
  type PersonaRequest,
} from "@titan/types";
import { readPersonaEntry } from "./persona-archive.ts";
import { advancePersona, personaEntryId } from "./persona-lifecycle.ts";
import { personaVersionOffers } from "./persona-offers.ts";
import { personaRecord } from "./persona-register.ts";
import { publishPersonaSampling } from "./persona-sampling.ts";

function identity(result: PersonaQualityResult): string {
  const { verdict: _verdict, ...key } = result;
  return hash(JSON.stringify(key));
}

export async function publishPersonaQuality(
  storage: PersonaQualityStorage,
  input: PersonaQualityResult,
): Promise<readonly PersonaRequest[]> {
  const result = PersonaQualityResultSchema.parse(input);
  const at = result.persona.lastIndexOf(PersonaRule.VersionMark);
  const name = result.persona.slice(0, at);
  const version = Number(result.persona.slice(at + 1));
  const { entry, bytes } = await readPersonaEntry(storage, personaEntryId(result.persona));
  const record = personaRecord(entry, name, version);
  const history = record.history ?? [];
  const outcome = identity({ ...result, later_refuted: undefined });
  const previous = history.find(
    (saved) => identity({ ...saved, later_refuted: undefined }) === outcome,
  );
  if (previous) {
    if (JSON.stringify(previous) !== JSON.stringify(result))
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    return (
      record.transitions?.find((transition) => transition.result === identity(result))?.requests ??
      []
    );
  }
  const results = [...history, result];
  const workers = history.filter((saved) => saved.role === NativeToolRole.Worker);
  const survived =
    record.survived ?? workers.filter((saved) => saved.verdict === Verdict.Survived).length;
  const refuted =
    record.refuted ?? workers.filter((saved) => saved.verdict === Verdict.Refuted).length;
  const body = PersonaRecordSchema.parse({
    ...record,
    history: results,
    uses: (record.uses ?? survived + refuted + history.length - workers.length) + 1,
    survived:
      survived +
      Number(result.role === NativeToolRole.Worker && result.verdict === Verdict.Survived),
    refuted:
      refuted + Number(result.role === NativeToolRole.Worker && result.verdict === Verdict.Refuted),
    runs:
      (record.runs ?? new Set(history.map((saved) => saved.run)).size) +
      Number(!history.some((saved) => saved.run === result.run)),
    falsifier_refutations:
      (record.falsifier_refutations ??
        history.filter(
          (saved) => saved.role === NativeToolRole.Checker && saved.verdict === Verdict.Refuted,
        ).length) +
      Number(result.role === NativeToolRole.Checker && result.verdict === Verdict.Refuted),
    falsifier_passes_later_refuted:
      (record.falsifier_passes_later_refuted ??
        history.filter((saved) => saved.later_refuted).length) + Number(!!result.later_refuted),
  });
  const advance = advancePersona({
    name: record.name,
    version: record.version,
    state: record.state ?? PersonaState.Proposed,
    survived: body.survived ?? 0,
    refuted: body.refuted ?? 0,
    role: record.persona.role,
  });
  if (advance.history.length)
    advance.requests.push(
      ...(await personaVersionOffers(storage, { ...body, state: advance.state })),
    );
  const transitions = advance.history.map((move) => ({
    result: identity(result),
    run: result.run,
    move,
    requests: advance.requests,
  }));
  const after = PersonaRecordSchema.parse({
    ...body,
    state: advance.state,
    ...(transitions.length ? { transitions: [...(record.transitions ?? []), ...transitions] } : {}),
  });
  const change = {
    before: entry,
    before_text: bytes.toString(FileEncoding.Utf8),
    after: { ...entry, version: entry.version + 1, body: Bun.YAML.stringify(after, null, 2) },
  };
  if (result.role === NativeToolRole.Worker && record.state !== PersonaState.Deleted)
    await publishPersonaSampling(storage, change, record, after, result, outcome);
  else await storage.publish(change);
  return advance.requests;
}
