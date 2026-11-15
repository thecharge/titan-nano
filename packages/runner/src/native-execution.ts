import { ExecutionPhase, NativeToolRole, StepStatus } from "@titan/constants";
import { errorMessage } from "@titan/errors";
import type {
  AgentEvent,
  NativeToolExecution,
  NativeToolExecutionOwner,
  PhaseExecution,
} from "@titan/types";
import { runKnowledgeScope } from "./knowledge.ts";
import { projectNativeEvent } from "./native-events.ts";

export function isWorkerKey(key: string): boolean {
  return (
    key === ExecutionPhase.Worker ||
    key.startsWith(ExecutionPhase.PartPrefix) ||
    key.startsWith(ExecutionPhase.HelperPrefix)
  );
}

export class ExecutionTools {
  private execution: NativeToolExecution | undefined;
  private finished = false;
  constructor(private owner: NativeToolExecutionOwner | undefined) {}
  get closed() {
    return this.finished;
  }
  get binding() {
    return this.execution?.binding;
  }
  get scanner() {
    return this.execution?.scanner;
  }
  open(context: PhaseExecution): void {
    const { run, step, state, key, execution_id, phase, signal } = context;
    const attempt = state.attempt;
    this.execution = this.owner?.open(
      {
        ...runKnowledgeScope(run, step, state),
        execution_id,
        role: isWorkerKey(key) ? NativeToolRole.Worker : NativeToolRole.Checker,
      },
      () =>
        state.attempt === attempt &&
        state.phases[key] === phase &&
        phase.execution_id === execution_id &&
        state.state === StepStatus.Running &&
        !signal.aborted,
      run.root,
    );
  }
  async guard(value: unknown): Promise<void> {
    await this.execution?.guard(value);
  }
  project(event: AgentEvent): AgentEvent {
    return projectNativeEvent(event, this.execution !== undefined);
  }
  async close(): Promise<void> {
    this.finished = true;
    const execution = this.execution;
    this.execution = undefined;
    if (!execution) return;
    try {
      await execution.close();
    } catch (error) {
      await execution.guard(errorMessage(error));
      throw error;
    }
  }
}
