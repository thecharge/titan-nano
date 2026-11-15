import { KnowledgeKind, KnowledgeLimit, KnowledgeSearchMode, PlanKeeping } from "@titan/constants";
import { all } from "@titan/core";
import {
  type KnowledgeClient,
  type PlanRecord,
  PlanRecordSchema,
  type PlansReport,
  PlansReportSchema,
} from "@titan/types";

export function planKeeper(hub: KnowledgeClient) {
  return async (record: PlanRecord): Promise<void> => {
    const parsed = PlanRecordSchema.parse(record);
    await hub.add({
      kind: KnowledgeKind.Plan,
      title: [parsed.kind, parsed.run_id].join(PlanKeeping.TitleSeparator),
      body: JSON.stringify(parsed),
      tags: [parsed.kind],
    });
  };
}

export async function topPlans(client: KnowledgeClient, kind: string): Promise<PlansReport> {
  const page = await client.search({
    kind: KnowledgeKind.Plan,
    mode: KnowledgeSearchMode.Words,
    limit: KnowledgeLimit.MaximumPage,
  });
  const found = await all(
    page.results
      .filter((result) => result.tags.includes(kind))
      .map(
        (result) => async () =>
          PlanRecordSchema.parse(JSON.parse((await client.get(result.id)).entry.body)),
      ),
  );
  const plans = found.sort((a, b) => b.reward - a.reward).slice(0, PlanKeeping.Count);
  return PlansReportSchema.parse({ kind, plans });
}
