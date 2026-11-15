import {
  DashboardProof,
  MeasureState,
  ProofAnswer,
  RunEventKind,
  UsageMetric,
} from "@titan/constants";
import { DashboardMessage } from "@titan/messages";
import {
  type EventPage,
  type Measure,
  type ProofCounts,
  ProofEventDataSchema,
  type Run,
  type RunEventView,
  type RunNumbers,
  RunNumbersSchema,
  type RunUsage,
} from "@titan/types";

const ending: ReadonlySet<string> = new Set([
  RunEventKind.PhaseCompleted,
  RunEventKind.ExecutionBlocked,
  RunEventKind.ExecutionRecovering,
]);

export async function* eventStream(
  read: (after: number) => Promise<EventPage>,
): AsyncGenerator<RunEventView> {
  let after = 0;
  let more = true;
  while (more) {
    const page = await read(after);
    yield* page.events;
    more = page.has_more;
    after = page.next_cursor;
  }
}

function missingContributions(run: Run, metric: UsageMetric): number {
  let missing = 0;
  for (const node of Object.values(run.nodes))
    for (const phase of [
      ...Object.values(node.phases),
      ...(node.reconciliations?.flatMap((generation) => Object.values(generation.phases)) ?? []),
    ])
      for (const entry of phase.usage) if (entry[metric] === null) missing++;
  return missing;
}

function measure(run: Run, usage: RunUsage, metric: UsageMetric): Measure {
  const value = usage.known[metric];
  const missing = usage.unreported_executions + missingContributions(run, metric);
  if (usage.complete[metric] && usage.reported_executions > 0)
    return { state: MeasureState.Complete, value, missing: 0, label: DashboardMessage.Complete };
  if (value === 0)
    return {
      state: MeasureState.NotReported,
      value: null,
      missing,
      label: DashboardMessage.NotReported,
    };
  return {
    state: MeasureState.Partial,
    value,
    missing,
    label: DashboardMessage.PartialLabel(missing),
  };
}

function stepKey(data: unknown): string {
  const record = Object(data) as Record<string, unknown>;
  return JSON.stringify([record.step_id, record.phase]);
}

function recordProof(proofs: ProofCounts, data: unknown): void {
  const parsed = ProofEventDataSchema.safeParse(data);
  if (!parsed.success) return;
  if (parsed.data.answer === ProofAnswer.Proven) proofs.proven++;
  else if (parsed.data.answer === ProofAnswer.Refuted) proofs.refuted++;
  else proofs.not_proven++;
}

export class RunNumberHistory {
  private open = new Set<string>();
  private proofs: ProofCounts = { proven: 0, refuted: 0, not_proven: 0 };
  private attempts = 0;
  private survived = 0;
  private refuted = 0;
  private most = 0;
  private first: number | undefined;
  private last = 0;

  constructor(private run: Run) {}

  observe(event: RunEventView): void {
    this.first ??= event.time;
    this.last = event.time;
    if (event.type === RunEventKind.AttemptStarted) this.attempts++;
    else if (event.type === RunEventKind.StepPassed) this.survived++;
    else if (event.type === RunEventKind.ResultRefuted) this.refuted++;
    else if (event.type === RunEventKind.ExecutionStarted) {
      this.open.add(stepKey(event.data));
      this.most = Math.max(this.most, this.open.size);
    } else if (ending.has(event.type)) this.open.delete(stepKey(event.data));
    else if (event.type === DashboardProof.EventType) recordProof(this.proofs, event.data);
  }

  finish(usage: RunUsage, run = this.run): RunNumbers {
    return RunNumbersSchema.parse({
      run_id: run.run_id,
      workflow_id: run.workflow_id,
      state: run.state,
      started_at: run.created_at,
      elapsed: Math.max(0, this.last - (this.first ?? this.last)),
      attempts: this.attempts,
      most_agents_at_once: this.most,
      input_tokens: measure(run, usage, UsageMetric.InputTokens),
      output_tokens: measure(run, usage, UsageMetric.OutputTokens),
      cost_usd: measure(run, usage, UsageMetric.Cost),
      survived: this.survived,
      refuted: this.refuted,
      proofs: this.proofs,
    });
  }
}

export async function runNumbers(
  run: Run,
  usage: RunUsage,
  events: AsyncIterable<RunEventView>,
): Promise<RunNumbers> {
  const history = new RunNumberHistory(run);
  for await (const event of events) history.observe(event);
  return history.finish(usage);
}
