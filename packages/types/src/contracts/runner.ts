import type { PersonaDecisionStage, RunEventKind } from "@titan/constants";
import type { Run, RunEvent } from "../board.ts";
import type { CommandCapture } from "../command-capture.ts";
import type { OpenCallPick, PersonaRequest } from "../persona-lifecycle.ts";
import type { OperationRequest } from "../requests.ts";
import type { RunHub } from "../run-hub.ts";
import type { ScriptExecution } from "../script-execution.ts";
import type { PersonaUsageReport } from "../usage.ts";
import type { RunProjectionWriter } from "./files.ts";
import type { KnowledgeAttemptOwner } from "./knowledge-attempts.ts";
import type { NativeToolExecutionOwner } from "./native-tools.ts";

export type RunCommit = (run: Run, type: RunEventKind, data?: unknown) => Promise<void>;
export type RunEventReader = (run: Run) => AsyncIterable<RunEvent>;
export type PersonaHistoryWriter = (
  run: Run,
  events: AsyncIterable<RunEvent>,
  request?: PersonaRequestWriter,
  usage?: readonly PersonaUsageReport[],
) => Promise<void>;
export type PersonaRequestWriter = (run: Run, request: PersonaRequest) => Promise<void>;
export type PersonaDecisionWriter = (
  request: OperationRequest,
  stage: PersonaDecisionStage,
) => Promise<void>;

export type ScriptCheck = (
  script: string,
  cwd: string,
  signal: AbortSignal,
  execution?: ScriptExecution,
) => Promise<CommandCapture>;

export type LeanRun = (
  command: readonly string[],
  cwd: string,
  timeout_ms: number,
  signal: AbortSignal,
) => Promise<CommandCapture>;

export type OpenCallResolver = (
  tags: readonly string[],
  excluded?: readonly string[],
) => Promise<OpenCallPick | null>;

export interface EngineServices {
  openCalls?: OpenCallResolver;
  scripts?: ScriptCheck;
  knowledge?: KnowledgeAttemptOwner;
  hub?: RunHub;
  personaHistory?: PersonaHistoryWriter;
  personaDecision?: PersonaDecisionWriter;
  nativeTools?: NativeToolExecutionOwner;
  clock?: () => Date;
  projectRun?: RunProjectionWriter;
  runtimePaths?: readonly string[];
  runtimeBuild?: string;
}
