import { ConfigInspection, ErrorCode, ExitCode } from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { TransportMessage } from "@titan/messages";
import { type Run, type RunConfiguration, RunConfigurationSchema } from "@titan/types";

export function readRunConfiguration(value: unknown, runId: string): RunConfiguration {
  const parsed = RunConfigurationSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.run_id !== runId ||
    hash(JSON.stringify(parsed.data.config.value)) !== parsed.data.config.hash
  )
    throw new TitanError(
      ErrorCode.InvalidResponse,
      TransportMessage.InvalidConfiguration,
      ExitCode.Transport,
    );
  return parsed.data;
}

export function describeRunConfiguration(run: Run): RunConfiguration {
  return readRunConfiguration(
    {
      schema_version: ConfigInspection.Version,
      run_id: run.run_id,
      workflow_id: run.workflow_id,
      workflow_revision: run.workflow_revision,
      through: run.version,
      config: run.config,
    },
    run.run_id,
  );
}
