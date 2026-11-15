import { ErrorCode, NativeToolEnvironment, TextSymbol } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { NativeToolBridgeMessage } from "@titan/messages";
import {
  type AgentHostSettings,
  AgentHostSettingsSchema,
  type NativeToolConnection,
  NativeToolConnectionSchema,
  NativeToolEnvironmentNumberSchema,
} from "@titan/types/native-tools";

export function nativeToolConnection(
  environment: Record<string, string | undefined> = process.env,
): NativeToolConnection {
  const part = environment[NativeToolEnvironment.PartId];
  const parsed = NativeToolConnectionSchema.safeParse({
    url: environment[NativeToolEnvironment.Url],
    token: environment[NativeToolEnvironment.Token],
    run_directory: environment[NativeToolEnvironment.RunDirectory],
    timeout_ms: NativeToolEnvironmentNumberSchema.safeParse(
      environment[NativeToolEnvironment.Timeout],
    ).data,
    scope: {
      run_id: environment[NativeToolEnvironment.RunId],
      role: environment[NativeToolEnvironment.Role],
      step_id: environment[NativeToolEnvironment.StepId],
      part_id: part === TextSymbol.Empty ? null : part,
      candidate_id: environment[NativeToolEnvironment.CandidateId],
      attempt: NativeToolEnvironmentNumberSchema.safeParse(
        environment[NativeToolEnvironment.Attempt],
      ).data,
      execution_id: environment[NativeToolEnvironment.ExecutionId],
    },
  });
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, NativeToolBridgeMessage.Invalid);
  return parsed.data;
}

export function nativeToolEnvironment(
  input: NativeToolConnection,
  settings: AgentHostSettings = nativeRuntimeSettings(),
): Record<string, string> {
  const connection = NativeToolConnectionSchema.parse(input);
  const limits = AgentHostSettingsSchema.parse(settings);
  return {
    [NativeToolEnvironment.GcMarkers]: String(limits.gc_markers),
    [NativeToolEnvironment.WorkerThreads]: String(limits.worker_threads),
    [NativeToolEnvironment.Url]: connection.url,
    [NativeToolEnvironment.Token]: connection.token,
    [NativeToolEnvironment.Timeout]: String(connection.timeout_ms),
    [NativeToolEnvironment.RunDirectory]: connection.run_directory,
    [NativeToolEnvironment.RunId]: connection.scope.run_id,
    [NativeToolEnvironment.Role]: connection.scope.role,
    [NativeToolEnvironment.StepId]: connection.scope.step_id,
    [NativeToolEnvironment.PartId]: connection.scope.part_id ?? TextSymbol.Empty,
    [NativeToolEnvironment.CandidateId]: connection.scope.candidate_id,
    [NativeToolEnvironment.Attempt]: String(connection.scope.attempt),
    [NativeToolEnvironment.ExecutionId]: connection.scope.execution_id,
  };
}

export function nativeAgentEnvironment(
  input: NativeToolConnection,
  environment: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const inherited: Record<string, string> = {};
  for (const [name, value] of Object.entries(environment))
    if (value !== undefined) inherited[name] = value;
  return { ...inherited, ...nativeToolEnvironment(input, nativeRuntimeSettings(environment)) };
}

function nativeRuntimeSettings(
  environment: Record<string, string | undefined> = process.env,
): AgentHostSettings {
  return AgentHostSettingsSchema.parse({
    gc_markers:
      environment[NativeToolEnvironment.GcMarkers] === undefined
        ? undefined
        : Number(environment[NativeToolEnvironment.GcMarkers]),
    worker_threads:
      environment[NativeToolEnvironment.WorkerThreads] === undefined
        ? undefined
        : Number(environment[NativeToolEnvironment.WorkerThreads]),
  });
}
