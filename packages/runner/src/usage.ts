import {
  Backend,
  ErrorCode,
  ExecutionPhase,
  RequestKind,
  RequestLimit,
  RunEventKind,
  ScriptExecution,
  StoreEviction,
  UsageMetric,
  UsageReport,
  VerifyKind,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import { BoundedStore } from "@titan/store";
import {
  OperationRequestSchema,
  type PersonaUsageReport,
  PersonaUsageReportSchema,
  type Phase,
  RequestTurnBatchSchema,
  type Run,
  type RunEvent,
  type RunUsage,
  RunUsageSchema,
  type Step,
  type StepAction,
  type Usage,
  type UsageCursor,
  type UsageKnown,
  type UsagePhasePolicy,
} from "@titan/types";
import { personaAction, resolvedPersona } from "@titan/workflow";
import { personaBackend } from "./backend-choice.ts";
import { referenceValue } from "./split.ts";

function cumulativeUsage(run: Run, action: StepAction): boolean {
  const worker = personaAction(action);
  if (!worker) return false;
  const persona = resolvedPersona(run.plan.workflow, worker.persona);
  return personaBackend(run, persona) === Backend.Claude;
}

function usagePolicy(run: Run, step: Step, action: StepAction): UsagePhasePolicy {
  const worker = personaAction(action);
  return {
    cumulative: cumulativeUsage(run, action),
    persona: worker
      ? (run.persona_references?.[worker.persona] ??
        (run.picks?.[step.id] === worker.persona ? worker.persona : undefined))
      : undefined,
  };
}

function emptyUsage(run: string, through: number): RunUsage {
  return {
    schema_version: UsageReport.Version,
    run_id: run,
    through,
    executions: 0,
    reported_executions: 0,
    unreported_executions: 0,
    known: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    complete: { input_tokens: true, output_tokens: true, cost_usd: true },
  };
}

function splitUsage(run: Run, step: Step) {
  const parts = step.split ? referenceValue(run, step.split.parts) : undefined;
  if (!Array.isArray(parts)) return [];
  return parts.map(
    (_part, index) =>
      [
        JSON.stringify([step.id, `${ExecutionPhase.PartPrefix}${index}`]),
        usagePolicy(run, step, step.do),
      ] as const,
  );
}

function proofUsage(step: Step) {
  return step.verify.flatMap((entry, index) =>
    entry.kind === VerifyKind.Script
      ? [
          `${ScriptExecution.ProofPrefix}${index}${ScriptExecution.ProofSeparator}${ScriptExecution.ProofFirst}`,
          `${ScriptExecution.ProofPrefix}${index}${ScriptExecution.ProofSeparator}${ScriptExecution.ProofRepeat}`,
          `${ScriptExecution.ProofResultPrefix}${index}`,
        ].map((phase) => [JSON.stringify([step.id, phase]), { cumulative: false }] as const)
      : [],
  );
}

function phasePolicies(run: Run) {
  return run.plan.nodes.flatMap((step) => [
    ...Object.entries(run.nodes[step.id]?.phases ?? {}).flatMap(([key, phase]) =>
      phase.helper
        ? [
            [
              JSON.stringify([step.id, key]),
              usagePolicy(run, step, {
                persona: phase.helper.persona,
                task: phase.helper.question,
              }),
            ] as const,
          ]
        : [],
    ),
    ...splitUsage(run, step),
    ...proofUsage(step),
    [JSON.stringify([step.id, ExecutionPhase.Worker]), usagePolicy(run, step, step.do)] as const,
    [
      JSON.stringify([step.id, ExecutionPhase.Worker, true]),
      usagePolicy(run, step, step.reconcile ?? step.do),
    ] as const,
    ...step.falsify.map(
      (action, index) =>
        [
          JSON.stringify([step.id, `${ExecutionPhase.FalsifierPrefix}${index}`]),
          usagePolicy(run, step, action),
        ] as const,
    ),
    ...step.checks.map(
      (_check, index) =>
        [
          JSON.stringify([step.id, `${ScriptExecution.CheckPrefix}${index}`]),
          { cumulative: false },
        ] as const,
    ),
  ]);
}

export class UsageHistory {
  private policy: string;
  private backend: string;
  private asks = new BoundedStore<string, string>({
    maxEntries: RequestLimit.PerRun,
    eviction: StoreEviction.Reject,
  });
  private cursors: BoundedStore<string, UsageCursor>;
  private allowed: BoundedStore<string, UsagePhasePolicy>;
  private personas: BoundedStore<string, PersonaUsageReport>;
  private result: RunUsage;
  constructor(run: Run) {
    const allowed = phasePolicies(run);
    this.policy = JSON.stringify(allowed);
    this.backend = JSON.stringify([run.backend, run.switched_backend]);
    this.allowed = new BoundedStore({
      maxEntries: allowed.length + RequestLimit.PerRun,
      eviction: StoreEviction.Reject,
    });
    for (const [key, cumulative] of allowed) this.allowed.set(key, cumulative);
    this.cursors = new BoundedStore({
      maxEntries: allowed.length + RequestLimit.PerRun,
      eviction: StoreEviction.Reject,
    });
    this.personas = new BoundedStore({
      maxEntries: allowed.length + RequestLimit.PerRun,
      eviction: StoreEviction.Reject,
    });
    this.result = emptyUsage(run.run_id, run.version);
  }
  observe(event: RunEvent) {
    if (event.state.run_id !== this.result.run_id || event.id > this.result.through)
      throw new TitanError(ErrorCode.CorruptBoard, RunnerMessage.UsageHistory);
    const backend = JSON.stringify([event.state.backend, event.state.switched_backend]);
    if (backend !== this.backend || event.type === RunEventKind.HelperStarted) {
      for (const [key, policy] of phasePolicies(event.state)) this.allowed.set(key, policy);
      this.backend = backend;
    }
    this.observeAsks(event);
    if (event.type === RunEventKind.Started && event.state.switched_backend)
      this.resetClearedPhases(event.state);
    for (const [step, node] of Object.entries(event.state.nodes))
      for (const [key, phase] of Object.entries(node.phases))
        this.phase(step, node.attempt, node.reconciliations?.length ?? 0, key, phase);
  }
  advance(event: RunEvent): void {
    if (event.id !== this.result.through + 1)
      throw new TitanError(ErrorCode.CorruptBoard, RunnerMessage.UsageHistory);
    this.result.through = event.id;
    this.observe(event);
  }
  matches(run: Run): boolean {
    return this.policy === JSON.stringify(phasePolicies(run));
  }
  private observeAsks(event: RunEvent): void {
    const requests =
      event.type === RunEventKind.RequestTurnOpened
        ? RequestTurnBatchSchema.parse(event.data)
        : event.type === RunEventKind.RequestOpened
          ? [OperationRequestSchema.parse(event.data)]
          : [];
    for (const request of requests) {
      const references = event.state.persona_references ?? {};
      const persona =
        references[request.scope.resource] ??
        Object.values(references).find((reference) => reference === request.scope.resource);
      if (request.kind !== RequestKind.Ask || !persona || this.asks.has(request.request_id))
        continue;
      this.asks.set(request.request_id, persona);
      const report = this.personas.get(persona) ?? {
        ...emptyUsage(this.result.run_id, this.result.through),
        persona,
      };
      report.asked = (report.asked ?? 0) + 1;
      this.personas.set(persona, report);
    }
  }
  private resetClearedPhases(run: Run): void {
    for (const key of this.cursors.keys()) {
      const [step, phase] = JSON.parse(key);
      if (!run.nodes[step]?.phases[phase]) this.cursors.delete(key);
    }
  }
  private phase(step: string, attempt: number, generation: number, key: string, phase: Phase) {
    const identity = JSON.stringify([step, key]);
    const policy =
      generation && key === ExecutionPhase.Worker ? JSON.stringify([step, key, true]) : identity;
    const previous = this.cursors.get(identity);
    if (
      !this.allowed.has(identity) ||
      (previous &&
        (attempt < previous.attempt ||
          (attempt === previous.attempt && generation < previous.generation)))
    )
      throw new TitanError(ErrorCode.CorruptBoard, RunnerMessage.UsageHistory);
    const cursor =
      previous?.attempt === attempt && previous.generation === generation ? previous : undefined;
    const recorded = cursor?.recorded ?? 0;
    const executions = cursor?.executions ?? 0;
    const dispatches = phase.dispatches ?? phase.executions;
    const dispatched = cursor?.dispatches ?? 0;
    if (
      phase.usage.length < recorded ||
      phase.executions < executions ||
      dispatches > phase.executions ||
      dispatches < dispatched ||
      phase.usage.length > dispatches ||
      (cursor && hash(JSON.stringify(phase.usage.slice(0, recorded))) !== cursor.prefix_hash)
    )
      throw new TitanError(ErrorCode.CorruptBoard, RunnerMessage.UsageHistory);
    const addition = emptyUsage(this.result.run_id, this.result.through);
    addition.executions = dispatches - dispatched;
    addition.reported_executions = phase.usage.length - recorded;
    const selected = this.allowed.get(policy);
    const high_water = cursor?.high_water ?? { input_tokens: 0, output_tokens: 0, cost_usd: 0 };
    for (const usage of phase.usage.slice(recorded))
      this.measure(usage, high_water, selected?.cumulative === true, addition);
    this.accumulate(this.result, addition);
    if (selected?.persona) {
      const report = this.personas.get(selected.persona) ?? {
        ...emptyUsage(this.result.run_id, this.result.through),
        persona: selected.persona,
      };
      this.accumulate(report, addition);
      this.personas.set(selected.persona, report);
    }
    this.cursors.set(identity, {
      attempt,
      generation,
      executions: phase.executions,
      dispatches,
      recorded: phase.usage.length,
      prefix_hash: hash(JSON.stringify(phase.usage)),
      high_water,
    });
  }
  private accumulate(report: RunUsage, addition: RunUsage): void {
    report.executions += addition.executions;
    report.reported_executions += addition.reported_executions;
    for (const metric of Object.values(UsageMetric)) {
      report.known[metric] += addition.known[metric];
      report.complete[metric] &&= addition.complete[metric];
    }
  }
  private measure(usage: Usage, highWater: UsageKnown, cumulative: boolean, report: RunUsage) {
    for (const metric of Object.values(UsageMetric))
      this.measureMetric(usage[metric], metric, highWater, cumulative, report);
  }
  private measureMetric(
    value: number | null,
    metric: UsageMetric,
    highWater: UsageKnown,
    cumulative: boolean,
    report: RunUsage,
  ) {
    if (value === null) {
      report.complete[metric] = false;
      return;
    }
    if (!cumulative) {
      report.known[metric] += value;
      return;
    }
    if (value < highWater[metric]) report.complete[metric] = false;
    report.known[metric] += Math.max(0, value - highWater[metric]);
    highWater[metric] = Math.max(highWater[metric], value);
  }
  private validate(report: RunUsage): RunUsage {
    const value = {
      ...report,
      unreported_executions: report.executions - report.reported_executions,
      complete: { ...report.complete },
    };
    if (value.unreported_executions)
      for (const metric of Object.values(UsageMetric)) value.complete[metric] = false;
    const result = RunUsageSchema.safeParse(value);
    if (!result.success) throw new TitanError(ErrorCode.CorruptBoard, RunnerMessage.UsageHistory);
    return result.data;
  }
  finish(): RunUsage {
    return this.validate(this.result);
  }
  finishPersonas(): PersonaUsageReport[] {
    return [...this.personas.values()].map((report) => {
      const { persona, asked = 0, ...usage } = report;
      return PersonaUsageReportSchema.parse({ ...this.validate(usage), persona, asked });
    });
  }
}

export async function summarizeUsage(run: Run, events: AsyncIterable<RunEvent>): Promise<RunUsage> {
  const history = new UsageHistory(run);
  for await (const event of events) history.observe(event);
  return history.finish();
}

export async function summarizePersonaUsage(
  run: Run,
  events: AsyncIterable<RunEvent>,
): Promise<PersonaUsageReport[]> {
  const history = new UsageHistory(run);
  for await (const event of events) history.observe(event);
  return history.finishPersonas();
}
