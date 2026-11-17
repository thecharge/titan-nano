import { ErrorCode, FileEncoding, PersonaRule, UsageMetric } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  type PersonaRegistryStorage,
  type PersonaUsageReport,
  PersonaUsageReportSchema,
  PersonaUsageSchema,
} from "@titan/types";
import { readPersonaEntry } from "./persona-archive.ts";
import { emptyPersonaUsage, personaEntryId } from "./persona-lifecycle.ts";
import { localPersonaReference, personaRecord } from "./persona-register.ts";

export async function publishPersonaUsage(
  storage: PersonaRegistryStorage,
  input: PersonaUsageReport,
): Promise<void> {
  const { persona, ...report } = PersonaUsageReportSchema.parse(input);
  const reference = localPersonaReference(persona);
  const at = reference.lastIndexOf(PersonaRule.VersionMark);
  const { entry, bytes } = await readPersonaEntry(storage, personaEntryId(reference));
  const record = personaRecord(entry, reference.slice(0, at), Number(reference.slice(at + 1)));
  const previous = record.usage?.reports.find((saved) => saved.run_id === report.run_id);
  if (previous && report.through < previous.through) return;
  if (previous && report.through === previous.through) {
    const { asked: priorAsked, ...priorUsage } = previous;
    const { asked, ...usage } = report;
    if (
      JSON.stringify(priorUsage) !== JSON.stringify(usage) ||
      (priorAsked !== undefined && priorAsked !== asked)
    )
      throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
    if (priorAsked !== undefined || asked === undefined) return;
  }
  if (
    previous &&
    (report.executions < previous.executions ||
      report.reported_executions < previous.reported_executions ||
      (previous.asked !== undefined &&
        (report.asked === undefined || report.asked < previous.asked)) ||
      Object.values(UsageMetric).some((metric) => report.known[metric] < previous.known[metric]))
  )
    throw new TitanError(ErrorCode.KnowledgeCorrupt, KnowledgeMessage.Corrupt);
  const usage = emptyPersonaUsage(record.usage?.history_complete ?? false);
  usage.reports = [
    ...(record.usage?.reports.filter((saved) => saved.run_id !== report.run_id) ?? []),
    report,
  ];
  for (const saved of usage.reports) {
    usage.executions += saved.executions;
    usage.reported_executions += saved.reported_executions;
    usage.unreported_executions += saved.unreported_executions;
    for (const metric of Object.values(UsageMetric)) {
      usage.known[metric] += saved.known[metric];
      usage.complete[metric] &&= saved.complete[metric];
    }
  }
  const body = {
    ...record,
    usage: PersonaUsageSchema.parse(usage),
    asked: usage.reports.reduce((total, saved) => total + (saved.asked ?? 0), 0),
    asked_history_complete:
      record.asked_history_complete === true &&
      usage.reports.every((saved) => saved.asked !== undefined),
  };
  await storage.publish({
    before: entry,
    before_text: bytes.toString(FileEncoding.Utf8),
    after: { ...entry, version: entry.version + 1, body: Bun.YAML.stringify(body, null, 2) },
  });
}
