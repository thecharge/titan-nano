import {
  ErrorCode,
  RunEventKind,
  RunHubLimit,
  type RunHubOutcome,
  RunHubTools,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { RunHubMessage } from "@titan/messages";
import {
  type NodeState,
  type PersonaHistoryWriter,
  type PersonaRequestWriter,
  type Run,
  type RunCommit,
  type RunEventReader,
  type RunHub,
  RunHubEventSchema,
  type Step,
} from "@titan/types";
import { runJournalStep } from "./run-journal.ts";
import { summarizePersonaUsage } from "./usage.ts";

export class RunHubFlow {
  constructor(
    private hub: RunHub | undefined,
    private commit: RunCommit,
    private events: RunEventReader,
    private personaHistory?: PersonaHistoryWriter,
    private personaRequest?: PersonaRequestWriter,
  ) {}

  tools(worker: boolean): readonly string[] {
    if (!this.hub) return [];
    return worker ? RunHubTools.Worker : RunHubTools.Checker;
  }

  async open(run: Run): Promise<void> {
    if (!this.hub) return;
    const offered: readonly string[] = this.hub.tools();
    const missing = RunHubTools.Worker.filter((tool) => !offered.includes(tool));
    if (missing.length)
      throw new TitanError(ErrorCode.KnowledgeUnavailable, RunHubMessage.ToolsMissing(missing));
    const entries = await this.hub.read(run.plan.workflow.goal, run.project);
    await this.commit(run, RunEventKind.HubRead, { entries });
  }

  async keep(
    run: Run,
    step: Step,
    state: NodeState,
    persona: string,
    outcome: RunHubOutcome,
    evidence: readonly string[],
  ): Promise<void> {
    if (!this.hub) return;
    const entry = await this.hub.keep(
      {
        run_id: run.run_id,
        step_id: step.id,
        persona,
        attempt: state.attempt,
        outcome,
        evidence: [...evidence],
      },
      run.project,
    );
    await this.commit(run, RunEventKind.HubWrote, { step_id: step.id, entries: [entry] });
  }

  private async lessons(run: Run): Promise<Map<string, string[]>> {
    const saved = new Map<string, string[]>();
    let retained = 0;
    for await (const event of this.events(run)) {
      if (event.type !== RunEventKind.HubWrote) continue;
      const written = RunHubEventSchema.parse(event.data);
      if (!written.step_id || !run.nodes[written.step_id]) continue;
      retained += written.entries.length;
      if (retained > RunHubLimit.JournalLessons)
        throw new TitanError(ErrorCode.KnowledgeUnavailable, RunHubMessage.JournalCapacity);
      saved.set(written.step_id, [
        ...(saved.get(written.step_id) ?? []),
        ...written.entries.map((entry) => entry.id),
      ]);
    }
    return saved;
  }

  async journal(run: Run): Promise<void> {
    if (this.personaHistory)
      await this.personaHistory(
        run,
        this.events(run),
        this.personaRequest,
        run.persona_references ? await summarizePersonaUsage(run, this.events(run)) : [],
      );
    if (!this.hub) return;
    const saved = await this.lessons(run);
    await this.hub.journal({
      run_id: run.run_id,
      project: run.project,
      goal: run.plan.workflow.goal,
      state: run.state,
      error: run.error,
      steps: run.plan.nodes.map((step) => runJournalStep(step, run.nodes[step.id], saved)),
    });
  }
}
